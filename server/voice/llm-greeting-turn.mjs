import { streamLlamaReply } from "./llama.mjs";
import { createSentenceChunker } from "./text.mjs";
import { emitTurnLog } from "./turn-logging.mjs";

export async function startLlmGreetingTurn({
	config,
	createLogEvent,
	history = [],
	log,
	logError,
	maxTokens,
	prompt,
	purpose,
	repeatPenalty,
	runtimeContext,
	sendJson,
	settings,
	speakSentence,
	startedAt,
	temperature,
	topP,
	transcript,
	turnRuntime,
	ws,
}) {
	const { controller, turn, turnId } = turnRuntime.begin({
		commitHistory: false,
		createLogEvent,
		startedAt,
		transcript,
		ws,
	});
	const chunker = createSentenceChunker();
	sendJson(ws, { type: "state", phase: "thinking" });
	log("turn", `start_${purpose} turn=${turnId}`);
	try {
		for await (const delta of streamLlamaReply({
			url: config.llamaUrl,
			history,
			prompt,
			runtimeContext,
			signal: controller.signal,
			systemPrompt: settings.systemPrompt,
			maxTokens,
			temperature,
			topP,
			repeatPenalty,
			purpose,
		})) {
			if (!turnRuntime.accepts(turn)) break;
			if (!delta) continue;
			turnRuntime.append(turn, delta);
			sendJson(ws, { type: "reply_delta", text: delta });
			for (const sentence of chunker.push(delta)) speakSentence(turn, sentence);
		}
		if (turnRuntime.accepts(turn)) {
			for (const sentence of chunker.flush()) speakSentence(turn, sentence);
			sendJson(ws, { type: "done", reply: turn.reply });
			turnRuntime.markDone(turn);
			turnRuntime.completeIfReady(turn);
		}
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") return;
		turnRuntime.clearIfActive(turn);
		emitTurnLog(turn, "error", {
			...(error instanceof Error
				? { error_name: error.name, error_message: error.message }
				: { error_message: String(error) }),
		});
		logError("turn", `${purpose} failed`, error, { turn_id: turnId });
		sendJson(ws, { type: "state", phase: "hearing" });
	} finally {
		turnRuntime.clearAbort(controller);
	}
}
