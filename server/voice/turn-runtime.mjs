import WebSocket from "ws";
import { cleanLlmText } from "./text.mjs";
import { emitTurnLog } from "./turn-logging.mjs";
import { sendJson } from "./wire.mjs";

export function createTurnRuntime({
	addHistory,
	log,
	resetToolActivity,
	sendToolState,
	setHearing,
	tts,
}) {
	let activeAbort;
	let activeTurn;
	let activeTurnId = 0;

	function accepts(turn) {
		return turn === activeTurn && turn.id === activeTurnId;
	}

	function cancel(reason) {
		if (activeTurn) {
			if (activeTurn.ws.readyState === WebSocket.OPEN)
				resetToolActivity({
					turn: activeTurn,
					sendToolState: (state) => sendToolState(activeTurn.ws, state),
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

	function begin({ createLogEvent, startedAt, transcript, ws }) {
		const controller = new AbortController();
		activeAbort = controller;
		const turn = {
			id: activeTurnId,
			llmDone: false,
			pendingSpeech: 0,
			reply: "",
			speechQueued: 0,
			startedAt,
			ws,
		};
		turn.userTranscript = transcript;
		turn.logEvent = createLogEvent(turn);
		activeTurn = turn;
		return { controller, turn, turnId: activeTurnId };
	}

	function append(turn, delta) {
		turn.reply += delta;
	}

	function queue(turn) {
		turn.pendingSpeech += 1;
		turn.speechQueued += 1;
		return turn.speechQueued;
	}

	function finishQueuedSpeech(turn) {
		turn.pendingSpeech = Math.max(0, turn.pendingSpeech - 1);
		return turn.pendingSpeech;
	}

	function markDone(turn) {
		turn.llmDone = true;
	}

	function completeIfReady(turn) {
		if (
			turn !== activeTurn ||
			!turn.llmDone ||
			turn.pendingSpeech !== 0 ||
			turn.ws.readyState !== WebSocket.OPEN
		)
			return false;
		const reply = cleanLlmText(turn.reply);
		log(
			"turn",
			`done turn=${turn.id} elapsed_ms=${Date.now() - turn.startedAt} chars=${reply.length}`,
		);
		emitTurnLog(turn, "success");
		resetToolActivity({
			turn,
			sendToolState: (state) => sendToolState(turn.ws, state),
		});
		addHistory(turn.ws, {
			user: turn.userTranscript,
			assistant: reply,
		});
		sendJson(turn.ws, { type: "turn_done", reply });
		setHearing(turn.ws);
		activeTurn = undefined;
		return true;
	}

	function clearAbort(controller) {
		if (activeAbort === controller) activeAbort = undefined;
	}

	function clearIfActive(turn) {
		if (turn === activeTurn) activeTurn = undefined;
	}

	return {
		accepts,
		append,
		begin,
		cancel,
		clearAbort,
		clearIfActive,
		completeIfReady,
		finishQueuedSpeech,
		markDone,
		queue,
	};
}
