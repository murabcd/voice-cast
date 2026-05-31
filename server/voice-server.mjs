#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import WebSocket, { WebSocketServer } from "ws";
import { config } from "./voice/config.mjs";
import { streamLlamaReply } from "./voice/llama.mjs";
import { log } from "./voice/logger.mjs";
import { createStaticServer } from "./voice/static-server.mjs";
import { SttWorker } from "./voice/stt-worker.mjs";
import {
	SupertonicTtsWorker,
	supertonicLanguages,
	supertonicVoiceNames,
} from "./voice/supertonic-tts-worker.mjs";
import { cleanLlmText, createSentenceChunker } from "./voice/text.mjs";
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

const server = createStaticServer(config);
const wss = new WebSocketServer({ server });

let activeClient;
let activeAbort;
let activeTurnId = 0;
let shuttingDown = false;

const clientSettings = new WeakMap();

function parseNumber(value, { min, max }) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return undefined;
	if (parsed < min || parsed > max) return undefined;
	return parsed;
}

function cancelTurn(reason) {
	activeTurnId += 1;
	activeAbort?.abort();
	activeAbort = undefined;
	tts.cancel(reason);
}

function closeClient(ws, code, reason) {
	try {
		ws.close(code, reason);
	} catch {
		// Socket may already be closed.
	}
}

function speakSentence(ws, sentence, turnId) {
	const text = cleanLlmText(sentence);
	if (!text || turnId !== activeTurnId || ws.readyState !== WebSocket.OPEN)
		return;
	const settings = clientSettings.get(ws) ?? {};
	sendJson(ws, { type: "state", phase: "speaking" });
	const queuedAt = Date.now();
	log(
		"tts",
		`queue turn=${turnId} chars=${text.length} text=${JSON.stringify(text)}`,
	);
	try {
		tts.speak(text, {
			lang: settings.language,
			voiceName: settings.voiceName,
			onStart: (sampleRate) => {
				if (turnId === activeTurnId) {
					log(
						"tts",
						`audio_start turn=${turnId} latency_ms=${Date.now() - queuedAt} sampleRate=${sampleRate}`,
					);
					sendBinary(ws, ttsFrameStart, sampleRatePayload(sampleRate));
				}
			},
			onAudio: (pcm) => {
				if (turnId === activeTurnId) sendBinary(ws, ttsFrameAudio, pcm);
			},
			onDone: () => {
				if (turnId !== activeTurnId) return;
				log(
					"tts",
					`audio_done turn=${turnId} elapsed_ms=${Date.now() - queuedAt}`,
				);
				sendBinary(ws, ttsFrameDone);
				sendJson(ws, { type: "state", phase: "hearing" });
			},
			onError: (message) => {
				if (turnId === activeTurnId) {
					sendBinary(ws, ttsFrameError, Buffer.from(message, "utf8"));
					sendJson(ws, { type: "error", message });
				}
			},
		});
	} catch (error) {
		sendJson(ws, {
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
	}
}

async function handleFinal(ws, transcript) {
	cancelTurn("new final");
	const turnId = activeTurnId;
	const controller = new AbortController();
	activeAbort = controller;
	const chunker = createSentenceChunker();
	let reply = "";
	let firstDeltaAt = 0;
	const startedAt = Date.now();
	const settings = clientSettings.get(ws) ?? {};

	sendJson(ws, { type: "transcript", text: transcript });
	sendJson(ws, { type: "state", phase: "thinking" });
	log("turn", `start turn=${turnId} transcript=${JSON.stringify(transcript)}`);

	try {
		for await (const delta of streamLlamaReply({
			url: config.llamaUrl,
			prompt: transcript,
			signal: controller.signal,
			systemPrompt: settings.systemPrompt,
			maxTokens: settings.maxTokens ?? config.llama.maxTokens,
			temperature: settings.temperature ?? config.llama.temperature,
			topP: settings.topP ?? config.llama.topP,
			repeatPenalty: settings.repeatPenalty ?? config.llama.repeatPenalty,
		})) {
			if (turnId !== activeTurnId) return;
			if (!firstDeltaAt) {
				firstDeltaAt = Date.now();
				log(
					"llm",
					`first_delta turn=${turnId} latency_ms=${firstDeltaAt - startedAt}`,
				);
			}
			reply += delta;
			sendJson(ws, { type: "reply_delta", text: delta });
			for (const sentence of chunker.push(delta))
				speakSentence(ws, sentence, turnId);
		}
		if (turnId !== activeTurnId) return;
		log(
			"llm",
			`done turn=${turnId} elapsed_ms=${Date.now() - startedAt} chars=${cleanLlmText(reply).length}`,
		);
		for (const sentence of chunker.flush()) speakSentence(ws, sentence, turnId);
		sendJson(ws, { type: "done", reply: cleanLlmText(reply) });
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") return;
		sendJson(ws, {
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
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
	sendJson(ws, { type: "status", text: "connected" });
	sendJson(ws, { type: "state", phase: "hearing" });

	const stt = new SttWorker({
		...config.stt,
		onEvent: (event) => {
			sendJson(ws, { type: "stt_event", event });
			if (event.type === "ready")
				log(
					"stt",
					`ready sampleRate=${event.sampleRate} vadChunkMs=${event.vadChunkMs}`,
				);
			if (event.type === "error")
				sendJson(ws, { type: "error", message: event.message });
			if (event.type === "final" && event.text?.trim())
				void handleFinal(ws, event.text.trim());
		},
		onExit: ({ stopped }) => {
			if (!stopped && ws.readyState === WebSocket.OPEN)
				sendJson(ws, { type: "error", message: "STT worker exited" });
		},
	});

	ws.on("message", (data, isBinary) => {
		try {
			if (isBinary) {
				const ok = stt.pushPcm(
					Buffer.isBuffer(data) ? data : Buffer.from(data),
				);
				if (!ok)
					sendJson(ws, { type: "warning", message: "STT input backpressure" });
				return;
			}
			const msg = JSON.parse(String(data));
			if (msg.type === "settings") {
				const maxTokens = Number(msg.maxTokens);
				const language = String(msg.language ?? "").trim();
				const voiceName = String(msg.voiceName ?? "").trim();
				clientSettings.set(ws, {
					systemPrompt: String(msg.systemPrompt ?? "").trim(),
					language: supertonicLanguages.has(language) ? language : undefined,
					voiceName: supertonicVoiceNames.has(voiceName)
						? voiceName
						: undefined,
					maxTokens:
						Number.isInteger(maxTokens) && maxTokens > 0
							? maxTokens
							: undefined,
					temperature: parseNumber(msg.temperature, { min: 0, max: 2 }),
					topP: parseNumber(msg.topP, { min: 0, max: 1 }),
					repeatPenalty: parseNumber(msg.repeatPenalty, { min: 1, max: 2 }),
				});
				return;
			}
			if (msg.type === "barge_in") {
				log("turn", "barge_in");
				cancelTurn("barge-in");
				sendJson(ws, { type: "status", text: "barge-in" });
				sendJson(ws, { type: "state", phase: "hearing" });
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
