#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import WebSocket, { WebSocketServer } from "ws";
import { McpTools } from "./ai/tools/mcp-tools.mjs";
import { OllamaWebTools } from "./ai/tools/ollama-web-tools.mjs";
import { buildVoiceToolRegistry } from "./ai/tools/tool-registry.mjs";
import {
	buildRuntimeCapabilities,
	capabilityReply,
	isCapabilityQuestion,
	runtimeCapabilityContext,
} from "./voice/capabilities.mjs";
import { runtimeCharacterContext } from "./voice/character-context.mjs";
import { parseClientSettingsMessage } from "./voice/client-settings.mjs";
import { config } from "./voice/config.mjs";
import { startImmediateTurn } from "./voice/immediate-turn.mjs";
import { streamLlamaReply } from "./voice/llama.mjs";
import { log, logError } from "./voice/logger.mjs";
import { openingReplyForSettings } from "./voice/opening-turn.mjs";
import {
	shouldClarifyRussianTranscript,
	shouldWaitForUser,
} from "./voice/realtime-voice-patterns.mjs";
import { planReply } from "./voice/reply-planner.mjs";
import { runtimeSessionContext } from "./voice/session-context.mjs";
import {
	createSessionHistory,
	isRepeatLastAnswerRequest,
} from "./voice/session-history.mjs";
import { normalizeRussianSpeechText } from "./voice/speech-normalization.mjs";
import { createStaticServer } from "./voice/static-server.mjs";
import { createSttSession } from "./voice/stt-session.mjs";
import { SupertonicTtsWorker } from "./voice/supertonic-tts-worker.mjs";
import { cleanLlmText, createSentenceChunker } from "./voice/text.mjs";
import {
	createToolActivityHandler,
	resetToolActivity,
} from "./voice/tool-activity.mjs";
import {
	createTurnLog,
	emitIgnoredTurnLog,
	emitTurnLog,
	recordFirstTtsAudio,
	recordQueuedSpeech,
	recordToolCall,
	recordToolPreamble,
	recordToolRoute,
} from "./voice/turn-logging.mjs";
import { createTurnRuntime } from "./voice/turn-runtime.mjs";
import {
	sampleRatePayload,
	sendBinary,
	sendJson,
	ttsFrameAudio,
	ttsFrameDone,
	ttsFrameError,
	ttsFrameStart,
} from "./voice/wire.mjs";

await mkdir(config.logDir, { recursive: true });

const tts = new SupertonicTtsWorker(config.tts);
await tts.ready;

const webTools = new OllamaWebTools({
	apiKey: config.webTools.ollamaApiKey,
	maxSearchResults: config.webTools.maxSearchResults,
	maxSearchResultContentChars: config.webTools.maxSearchResultContentChars,
	maxFetchContentChars: config.webTools.maxFetchContentChars,
	maxFetchLinks: config.webTools.maxFetchLinks,
});
log(
	"tool",
	webTools.enabled
		? `ollama web tools enabled tools=${webTools.tools.length}`
		: "ollama web tools disabled: OLLAMA_API_KEY is not configured",
);
const mcpTools = new McpTools(config.mcp);
try {
	await mcpTools.connect();
	log(
		"tool",
		mcpTools.enabled
			? `mcp tools enabled tools=${mcpTools.tools.length}`
			: "mcp tools disabled: no configured servers",
	);
} catch (error) {
	logError("tool", "mcp tools failed to start", error);
}

const server = createStaticServer(config);
const wss = new WebSocketServer({ server });

let activeClient;
let shuttingDown = false;

const clientSettings = new WeakMap();
const clientHistory = new WeakMap();
const clientOpeningStarted = new WeakSet();

function closeClient(ws, code, reason) {
	try {
		ws.close(code, reason);
	} catch {}
}

const turnRuntime = createTurnRuntime({
	addHistory: (ws, item) => clientHistory.get(ws)?.add(item),
	log,
	resetToolActivity,
	sendToolState: (ws, state) =>
		sendJson(ws, { type: "tool_activity", ...state }),
	setHearing: (ws) => sendJson(ws, { type: "state", phase: "hearing" }),
	tts,
});

function speakSentence(turn, sentence) {
	const text = cleanLlmText(sentence);
	const settings = clientSettings.get(turn.ws) ?? {};
	const spokenText =
		settings.language === "ru" ? normalizeRussianSpeechText(text) : text;
	if (
		!text ||
		!spokenText ||
		!turnRuntime.accepts(turn) ||
		turn.ws.readyState !== WebSocket.OPEN
	)
		return;
	const queuedAt = Date.now();
	const speechIndex = turnRuntime.queue(turn);
	recordQueuedSpeech({
		turn,
		text,
		spokenText,
		queuedAt,
		speechIndex,
	});
	log(
		"tts",
		`queue turn=${turn.id} speech=${speechIndex} pending=${turn.pendingSpeech} latency_ms=${queuedAt - turn.startedAt} lang=${settings.language ?? ""} voice=${settings.voiceName ?? ""} chars=${text.length} text=${JSON.stringify(text)} spoken=${JSON.stringify(spokenText)}`,
	);
	try {
		tts.speak(spokenText, {
			lang: settings.language,
			voiceName: settings.voiceName,
			onStart: (sampleRate) => {
				if (turnRuntime.accepts(turn)) {
					recordFirstTtsAudio(turn);
					log(
						"tts",
						`audio_start turn=${turn.id} speech=${speechIndex} latency_ms=${Date.now() - queuedAt} turn_latency_ms=${Date.now() - turn.startedAt} sampleRate=${sampleRate}`,
					);
					sendJson(turn.ws, { type: "state", phase: "speaking" });
					sendBinary(turn.ws, ttsFrameStart, sampleRatePayload(sampleRate));
				}
			},
			onAudio: (pcm) => {
				if (turnRuntime.accepts(turn)) sendBinary(turn.ws, ttsFrameAudio, pcm);
			},
			onDone: () => {
				if (!turnRuntime.accepts(turn)) return;
				turnRuntime.finishQueuedSpeech(turn);
				log(
					"tts",
					`audio_done turn=${turn.id} speech=${speechIndex} pending=${turn.pendingSpeech} elapsed_ms=${Date.now() - queuedAt} turn_latency_ms=${Date.now() - turn.startedAt}`,
				);
				sendBinary(turn.ws, ttsFrameDone);
				turnRuntime.completeIfReady(turn);
			},
			onError: (message) => {
				if (turnRuntime.accepts(turn)) {
					turnRuntime.finishQueuedSpeech(turn);
					sendBinary(turn.ws, ttsFrameError, Buffer.from(message, "utf8"));
					sendJson(turn.ws, { type: "error", message });
					turnRuntime.completeIfReady(turn);
				}
			},
		});
	} catch (error) {
		turnRuntime.finishQueuedSpeech(turn);
		sendJson(turn.ws, {
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
		turnRuntime.completeIfReady(turn);
	}
}

function completeImmediateReply(turn, reply) {
	turnRuntime.append(turn, reply);
	sendJson(turn.ws, { type: "reply_delta", text: reply });
	sendJson(turn.ws, { type: "done", reply });
	speakSentence(turn, reply);
	turnRuntime.markDone(turn);
	turnRuntime.completeIfReady(turn);
}

function startOpeningTurn(ws) {
	if (clientOpeningStarted.has(ws) || ws.readyState !== WebSocket.OPEN) return;
	const settings = clientSettings.get(ws) ?? {};
	if (!settings.autoGreetingEnabled) return;
	const startedAt = Date.now();
	clientOpeningStarted.add(ws);
	if (turnRuntime.hasActive()) turnRuntime.cancel("opening turn");
	const { turnId } = startImmediateTurn({
		commitHistory: false,
		log,
		reply: openingReplyForSettings(settings),
		sendJson,
		speakSentence,
		startedAt,
		transcript: "[server opening]",
		turnRuntime,
		ws,
		createLogEvent: (newTurn) => ({
			...createTurnLog({
				turnId: newTurn.id,
				startedAt,
				transcript: "[server opening]",
				settings,
				config,
			}),
			turn_source: "server_opening",
		}),
	});
	log("turn", `start_opening turn=${turnId}`);
}

async function handleFinal(ws, transcript) {
	const normalizedTranscript = String(transcript ?? "").trim();
	if (shouldWaitForUser(normalizedTranscript)) {
		emitIgnoredTurnLog({
			reason: "wait_for_user",
			transcript: normalizedTranscript,
		});
		log(
			"turn",
			`wait_for_user transcript=${JSON.stringify(normalizedTranscript)}`,
		);
		sendJson(ws, { type: "transcript", text: normalizedTranscript });
		sendJson(ws, { type: "state", phase: "hearing" });
		return;
	}
	turnRuntime.cancel("new final");
	const chunker = createSentenceChunker();
	let firstDeltaAt = 0;
	const startedAt = Date.now();
	const settings = clientSettings.get(ws) ?? {};
	const history = clientHistory.get(ws) ?? createSessionHistory();
	const registry = buildVoiceToolRegistry({
		settings,
		webTools,
		mcpTools,
		trackerDefaultQueue: config.mcp?.trackerDefaultQueue,
		trackerLimitQueues: config.mcp?.trackerLimitQueues,
	});
	const capabilities = buildRuntimeCapabilities({
		registry,
		settings,
		webTools,
		mcpTools,
	});
	const runtimeContext = [
		runtimeSessionContext({ language: settings.language }),
		runtimeCapabilityContext(capabilities),
		runtimeCharacterContext({
			characterId: settings.characterId,
			language: settings.language,
		}),
	]
		.filter(Boolean)
		.join("\n\n");
	const { controller, turn, turnId } = turnRuntime.begin({
		startedAt,
		transcript: normalizedTranscript,
		ws,
		createLogEvent: (newTurn) =>
			createTurnLog({
				turnId: newTurn.id,
				startedAt,
				transcript: normalizedTranscript,
				settings,
				config,
			}),
	});
	turn.logEvent.history_turns = history.size();
	turn.logEvent.history_chars = history.messageChars();
	turn.logEvent.summary_chars = history.summaryChars();

	sendJson(ws, { type: "transcript", text: normalizedTranscript });
	sendJson(ws, { type: "state", phase: "thinking" });
	log(
		"turn",
		`start turn=${turnId} transcript=${JSON.stringify(normalizedTranscript)}`,
	);

	if (
		settings.language === "ru" &&
		shouldClarifyRussianTranscript(normalizedTranscript)
	) {
		completeImmediateReply(
			turn,
			"Не расслышал. Повтори, пожалуйста, по-русски.",
		);
		return;
	}

	const lastAssistant = history.lastAssistant();
	if (lastAssistant && isRepeatLastAnswerRequest(normalizedTranscript)) {
		completeImmediateReply(turn, lastAssistant);
		return;
	}

	if (isCapabilityQuestion(normalizedTranscript)) {
		completeImmediateReply(turn, capabilityReply(capabilities));
		return;
	}

	try {
		const messages = await planReply({
			config,
			history: history.messages(),
			historyContext: { web: history.webContext() },
			registry,
			prompt: normalizedTranscript,
			runtimeContext,
			settings,
			signal: controller.signal,
			toolManager: webTools,
			mcpTools,
			turnId,
			onEvent: createToolPlanningEventHandler({ startedAt, turn, ws }),
		});
		if (messages?.kind === "direct_reply") {
			completeImmediateReply(turn, messages.reply);
			return;
		}
		for await (const delta of streamLlamaReply({
			url: config.llamaUrl,
			history: history.messages(),
			prompt: normalizedTranscript,
			runtimeContext,
			signal: controller.signal,
			systemPrompt: settings.systemPrompt,
			messages,
			maxTokens: settings.maxTokens ?? config.llama.maxTokens,
			temperature: settings.temperature ?? config.llama.temperature,
			topP: settings.topP ?? config.llama.topP,
			repeatPenalty: settings.repeatPenalty ?? config.llama.repeatPenalty,
		})) {
			if (!turnRuntime.accepts(turn)) return;
			if (!firstDeltaAt) {
				firstDeltaAt = Date.now();
				turn.logEvent.first_delta_ms = firstDeltaAt - startedAt;
				log(
					"llm",
					`first_delta turn=${turnId} latency_ms=${firstDeltaAt - startedAt}`,
				);
			}
			turnRuntime.append(turn, delta);
			sendJson(ws, { type: "reply_delta", text: delta });
			for (const sentence of chunker.push(delta)) speakSentence(turn, sentence);
		}
		if (!turnRuntime.accepts(turn)) return;
		log(
			"llm",
			`done turn=${turnId} elapsed_ms=${Date.now() - startedAt} chars=${cleanLlmText(turn.reply).length}`,
		);
		for (const sentence of chunker.flush()) speakSentence(turn, sentence);
		turnRuntime.markDone(turn);
		sendJson(ws, { type: "done", reply: cleanLlmText(turn.reply) });
		turnRuntime.completeIfReady(turn);
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") return;
		turnRuntime.clearIfActive(turn);
		emitTurnLog(turn, "error", {
			...(error instanceof Error
				? { error_name: error.name, error_message: error.message }
				: { error_message: String(error) }),
		});
		logError("turn", "voice turn failed", error, { turn_id: turnId });
		sendJson(ws, { type: "tool_activity", active: false });
		sendJson(ws, {
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
		sendJson(ws, { type: "state", phase: "hearing" });
	} finally {
		turnRuntime.clearAbort(controller);
	}
}

function createToolPlanningEventHandler({ startedAt, turn, ws }) {
	const handleToolActivity = createToolActivityHandler({
		turn,
		canAccept: () => turnRuntime.accepts(turn),
		recordToolCall,
		sendToolState: (state) => sendJson(ws, { type: "tool_activity", ...state }),
	});
	return (event) => {
		if (event.type === "tool_route") {
			recordToolRoute({ turn, route: event });
			return;
		}
		if (event.type === "preamble") {
			recordToolPreamble({ turn, sentence: event.sentence, startedAt });
			speakSentence(turn, event.sentence);
			return;
		}
		if (event.type === "tool_activity") handleToolActivity(event);
		if (event.type === "tool_result") sendJson(ws, event);
	};
}

wss.on("connection", (ws) => {
	if (shuttingDown) {
		closeClient(ws, 1012, "Server is restarting");
		return;
	}
	if (activeClient?.readyState === WebSocket.OPEN) {
		closeClient(ws, 1008, "Only one client may connect");
		return;
	}

	activeClient = ws;
	clientSettings.set(ws, {});
	clientHistory.set(ws, createSessionHistory());
	sendJson(ws, { type: "status", text: "connected" });
	sendJson(ws, { type: "state", phase: "warming" });

	const stt = createSttSession({
		config: config.stt,
		log,
		onError: (message) => {
			if (ws.readyState === WebSocket.OPEN)
				sendJson(ws, { type: "error", message });
		},
		onEvent: (event) => sendJson(ws, { type: "stt_event", event }),
		onFinal: (text) => void handleFinal(ws, text),
		onPhase: (phase) => sendJson(ws, { type: "state", phase }),
		onReady: (ready) => sendJson(ws, { type: "stt_ready", ready }),
	});

	ws.on("message", async (data, isBinary) => {
		try {
			if (isBinary) {
				const ok = stt.pushPcm(data);
				if (!ok)
					sendJson(ws, { type: "warning", message: "STT input backpressure" });
				return;
			}
			const msg = JSON.parse(String(data));
			if (msg.type === "settings") {
				const parsed = parseClientSettingsMessage(msg);
				clientSettings.set(ws, parsed.settings);
				log(
					"settings",
					`language=${parsed.logFields.language} voice=${parsed.logFields.voiceName} character=${parsed.logFields.characterId} auto_greeting=${parsed.logFields.autoGreetingEnabled} prompt=${JSON.stringify(parsed.logFields.systemPromptPreview)}`,
				);
				startOpeningTurn(ws);
				return;
			}
			if (msg.type === "barge_in") {
				log("turn", "barge_in");
				turnRuntime.cancel("barge-in");
				stt.restart("barge-in");
				sendJson(ws, { type: "status", text: "barge-in" });
			}
		} catch (error) {
			sendJson(ws, {
				type: "error",
				message: error instanceof Error ? error.message : String(error),
			});
		}
	});

	ws.on("close", () => {
		turnRuntime.cancel("client closed");
		stt.stop();
		if (activeClient === ws) activeClient = undefined;
	});

	ws.on("error", (error) => {
		log("server", `websocket error: ${error.message}`);
	});
});

function shutdown(signal) {
	if (shuttingDown) return;
	shuttingDown = true;
	log("server", `shutting down on ${signal}`);
	turnRuntime.cancel("server shutdown");
	if (activeClient?.readyState === WebSocket.OPEN)
		closeClient(activeClient, 1012, "Server is restarting");
	wss.close();
	server.close(() => {
		tts.shutdown();
		void mcpTools.close();
		process.exit(0);
	});
	setTimeout(() => {
		tts.shutdown();
		void mcpTools.close();
		process.exit(1);
	}, 3000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(config.port, "127.0.0.1", () => {
	log("server", `Voice server listening on http://127.0.0.1:${config.port}`);
});
