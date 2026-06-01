#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import WebSocket, { WebSocketServer } from "ws";
import { OllamaWebTools } from "./ai/tools/ollama-web-tools.mjs";
import { parseClientSettingsMessage } from "./voice/client-settings.mjs";
import { config } from "./voice/config.mjs";
import { streamLlamaReply } from "./voice/llama.mjs";
import { log, logError } from "./voice/logger.mjs";
import {
	shouldClarifyRussianTranscript,
	shouldWaitForUser,
} from "./voice/realtime-voice-patterns.mjs";
import { planReply } from "./voice/reply-planner.mjs";
import {
	createSessionHistory,
	isRepeatLastAnswerRequest,
} from "./voice/session-history.mjs";
import { normalizeRussianSpeechText } from "./voice/speech-normalization.mjs";
import { createStaticServer } from "./voice/static-server.mjs";
import { SttWorker } from "./voice/stt-worker.mjs";
import { SupertonicTtsWorker } from "./voice/supertonic-tts-worker.mjs";
import { cleanLlmText, createSentenceChunker } from "./voice/text.mjs";
import {
	createToolActivityHandler,
	resetToolActivity,
} from "./voice/tool-activity.mjs";
import {
	appendReply,
	canAcceptTurn,
	createTurn,
	finishSpeech,
	isTurnComplete,
	markLlmDone,
	queueSpeech,
} from "./voice/turn-lifecycle.mjs";
import {
	createTurnLog,
	emitIgnoredTurnLog,
	emitTurnLog,
	recordFirstTtsAudio,
	recordQueuedSpeech,
	recordToolCall,
	recordToolPreamble,
} from "./voice/turn-logging.mjs";
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

const server = createStaticServer(config);
const wss = new WebSocketServer({ server });

let activeClient;
let activeAbort;
let activeTurnId = 0;
let activeTurn;
let shuttingDown = false;

const clientSettings = new WeakMap();
const clientHistory = new WeakMap();

function cancelTurn(reason) {
	if (activeTurn) {
		if (activeTurn.ws.readyState === WebSocket.OPEN)
			resetToolActivity({
				turn: activeTurn,
				sendToolState: (state) =>
					sendJson(activeTurn.ws, { type: "web_search", ...state }),
			});
		emitTurnLog(activeTurn, "cancelled", {
			cancel_reason: reason,
		});
	}
	activeTurnId += 1;
	activeAbort?.abort();
	activeAbort = undefined;
	activeTurn = undefined;
	tts.cancel(reason);
}

function closeClient(ws, code, reason) {
	try {
		ws.close(code, reason);
	} catch {}
}

function maybeCompleteTurn(turn) {
	if (
		turn !== activeTurn ||
		!isTurnComplete(turn) ||
		turn.ws.readyState !== WebSocket.OPEN
	)
		return;
	log(
		"turn",
		`done turn=${turn.id} elapsed_ms=${Date.now() - turn.startedAt} chars=${cleanLlmText(turn.reply).length}`,
	);
	emitTurnLog(turn, "success");
	resetToolActivity({
		turn,
		sendToolState: (state) =>
			sendJson(turn.ws, { type: "web_search", ...state }),
	});
	clientHistory.get(turn.ws)?.add({
		user: turn.userTranscript,
		assistant: cleanLlmText(turn.reply),
	});
	sendJson(turn.ws, { type: "turn_done", reply: cleanLlmText(turn.reply) });
	sendJson(turn.ws, { type: "state", phase: "hearing" });
	activeTurn = undefined;
}

function speakSentence(turn, sentence) {
	const text = cleanLlmText(sentence);
	const settings = clientSettings.get(turn.ws) ?? {};
	const spokenText =
		settings.language === "ru" ? normalizeRussianSpeechText(text) : text;
	if (
		!text ||
		!spokenText ||
		!canAcceptTurn(activeTurn, turn, activeTurnId) ||
		turn.ws.readyState !== WebSocket.OPEN
	)
		return;
	const queuedAt = Date.now();
	const speechIndex = queueSpeech(turn);
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
				if (canAcceptTurn(activeTurn, turn, activeTurnId)) {
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
				if (canAcceptTurn(activeTurn, turn, activeTurnId))
					sendBinary(turn.ws, ttsFrameAudio, pcm);
			},
			onDone: () => {
				if (!canAcceptTurn(activeTurn, turn, activeTurnId)) return;
				finishSpeech(turn);
				log(
					"tts",
					`audio_done turn=${turn.id} speech=${speechIndex} pending=${turn.pendingSpeech} elapsed_ms=${Date.now() - queuedAt} turn_latency_ms=${Date.now() - turn.startedAt}`,
				);
				sendBinary(turn.ws, ttsFrameDone);
				maybeCompleteTurn(turn);
			},
			onError: (message) => {
				if (canAcceptTurn(activeTurn, turn, activeTurnId)) {
					finishSpeech(turn);
					sendBinary(turn.ws, ttsFrameError, Buffer.from(message, "utf8"));
					sendJson(turn.ws, { type: "error", message });
					maybeCompleteTurn(turn);
				}
			},
		});
	} catch (error) {
		finishSpeech(turn);
		sendJson(turn.ws, {
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
		maybeCompleteTurn(turn);
	}
}

function completeImmediateReply(turn, reply) {
	appendReply(turn, reply);
	sendJson(turn.ws, { type: "reply_delta", text: reply });
	sendJson(turn.ws, { type: "done", reply });
	speakSentence(turn, reply);
	markLlmDone(turn);
	maybeCompleteTurn(turn);
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
	cancelTurn("new final");
	const turnId = activeTurnId;
	const controller = new AbortController();
	activeAbort = controller;
	const chunker = createSentenceChunker();
	let firstDeltaAt = 0;
	const startedAt = Date.now();
	const settings = clientSettings.get(ws) ?? {};
	const history = clientHistory.get(ws) ?? createSessionHistory();
	const turn = createTurn({
		id: turnId,
		startedAt,
		ws,
	});
	turn.userTranscript = normalizedTranscript;
	turn.logEvent = createTurnLog({
		turnId,
		startedAt,
		transcript: normalizedTranscript,
		settings,
		config,
	});
	turn.logEvent.history_turns = history.size();
	activeTurn = turn;

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

	try {
		const messages = await planReply({
			config,
			history: history.messages(),
			prompt: normalizedTranscript,
			settings,
			signal: controller.signal,
			toolManager: webTools,
			turnId,
			onPreamble: (sentence) => {
				recordToolPreamble({ turn, sentence, startedAt });
				speakSentence(turn, sentence);
			},
			onToolActivity: createToolActivityHandler({
				turn,
				canAccept: () => canAcceptTurn(activeTurn, turn, activeTurnId),
				recordToolCall,
				sendToolState: (state) =>
					sendJson(ws, { type: "web_search", ...state }),
			}),
		});
		if (messages?.kind === "direct_reply") {
			completeImmediateReply(turn, messages.reply);
			return;
		}
		for await (const delta of streamLlamaReply({
			url: config.llamaUrl,
			history: history.messages(),
			prompt: normalizedTranscript,
			signal: controller.signal,
			systemPrompt: settings.systemPrompt,
			messages,
			maxTokens: settings.maxTokens ?? config.llama.maxTokens,
			temperature: settings.temperature ?? config.llama.temperature,
			topP: settings.topP ?? config.llama.topP,
			repeatPenalty: settings.repeatPenalty ?? config.llama.repeatPenalty,
		})) {
			if (!canAcceptTurn(activeTurn, turn, activeTurnId)) return;
			if (!firstDeltaAt) {
				firstDeltaAt = Date.now();
				turn.logEvent.first_delta_ms = firstDeltaAt - startedAt;
				log(
					"llm",
					`first_delta turn=${turnId} latency_ms=${firstDeltaAt - startedAt}`,
				);
			}
			appendReply(turn, delta);
			sendJson(ws, { type: "reply_delta", text: delta });
			for (const sentence of chunker.push(delta)) speakSentence(turn, sentence);
		}
		if (!canAcceptTurn(activeTurn, turn, activeTurnId)) return;
		log(
			"llm",
			`done turn=${turnId} elapsed_ms=${Date.now() - startedAt} chars=${cleanLlmText(turn.reply).length}`,
		);
		for (const sentence of chunker.flush()) speakSentence(turn, sentence);
		markLlmDone(turn);
		sendJson(ws, { type: "done", reply: cleanLlmText(turn.reply) });
		maybeCompleteTurn(turn);
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") return;
		if (turn === activeTurn) activeTurn = undefined;
		emitTurnLog(turn, "error", {
			...(error instanceof Error
				? { error_name: error.name, error_message: error.message }
				: { error_message: String(error) }),
		});
		logError("turn", "voice turn failed", error, { turn_id: turnId });
		sendJson(ws, { type: "web_search", active: false });
		sendJson(ws, {
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
		sendJson(ws, { type: "state", phase: "hearing" });
	} finally {
		if (activeAbort === controller) activeAbort = undefined;
	}
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

	let sttSessionId = 0;
	let sttReady = false;
	let stt = startSttWorker();

	function startSttWorker() {
		sttSessionId += 1;
		const sessionId = sttSessionId;
		sttReady = false;
		sendJson(ws, { type: "state", phase: "warming" });
		sendJson(ws, { type: "stt_ready", ready: false });
		return new SttWorker({
			...config.stt,
			onEvent: (event) => {
				if (sessionId !== sttSessionId) return;
				sendJson(ws, { type: "stt_event", event });
				if (event.type === "ready") {
					log(
						"stt",
						`ready session=${sessionId} sampleRate=${event.sampleRate} vadChunkMs=${event.vadChunkMs}`,
					);
					sttReady = true;
					sendJson(ws, { type: "stt_ready", ready: true });
					sendJson(ws, { type: "state", phase: "hearing" });
				}
				if (event.type === "error")
					sendJson(ws, { type: "error", message: event.message });
				if (event.type === "final" && event.text?.trim())
					void handleFinal(ws, event.text.trim());
			},
			onExit: ({ stopped }) => {
				if (
					sessionId === sttSessionId &&
					!stopped &&
					ws.readyState === WebSocket.OPEN
				)
					sendJson(ws, { type: "error", message: "STT worker exited" });
			},
		});
	}

	function restartSttWorker(reason) {
		log("stt", `restart reason=${reason}`);
		stt.stop();
		stt = startSttWorker();
	}

	ws.on("message", async (data, isBinary) => {
		try {
			if (isBinary) {
				if (!sttReady) return;
				const ok = stt.pushPcm(
					Buffer.isBuffer(data) ? data : Buffer.from(data),
				);
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
					`language=${parsed.logFields.language} voice=${parsed.logFields.voiceName} prompt=${JSON.stringify(parsed.logFields.systemPromptPreview)}`,
				);
				return;
			}
			if (msg.type === "barge_in") {
				log("turn", "barge_in");
				cancelTurn("barge-in");
				restartSttWorker("barge-in");
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
		cancelTurn("client closed");
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
	cancelTurn("server shutdown");
	if (activeClient?.readyState === WebSocket.OPEN)
		closeClient(activeClient, 1012, "Server is restarting");
	wss.close();
	server.close(() => {
		tts.shutdown();
		process.exit(0);
	});
	setTimeout(() => {
		tts.shutdown();
		process.exit(1);
	}, 3000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(config.port, "127.0.0.1", () => {
	log("server", `Voice server listening on http://127.0.0.1:${config.port}`);
});
