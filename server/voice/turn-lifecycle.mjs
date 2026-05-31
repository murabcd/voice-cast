export function createTurn({ id, startedAt, ws }) {
	return {
		id,
		llmDone: false,
		pendingSpeech: 0,
		reply: "",
		speechQueued: 0,
		startedAt,
		ws,
	};
}

export function canAcceptTurn(activeTurn, turn, activeTurnId) {
	return turn === activeTurn && turn.id === activeTurnId;
}

export function appendReply(turn, delta) {
	turn.reply += delta;
}

export function queueSpeech(turn) {
	turn.pendingSpeech += 1;
	turn.speechQueued += 1;
	return turn.speechQueued;
}

export function finishSpeech(turn) {
	turn.pendingSpeech = Math.max(0, turn.pendingSpeech - 1);
	return turn.pendingSpeech;
}

export function markLlmDone(turn) {
	turn.llmDone = true;
}

export function isTurnComplete(turn) {
	return turn.llmDone && turn.pendingSpeech === 0;
}
