export function startImmediateTurn({
	commitHistory = true,
	createLogEvent,
	log,
	reply,
	sendJson,
	speakSentence,
	startedAt = Date.now(),
	transcript,
	turnRuntime,
	ws,
}) {
	const { controller, turn, turnId } = turnRuntime.begin({
		commitHistory,
		createLogEvent,
		startedAt,
		transcript,
		ws,
	});
	sendJson(ws, { type: "state", phase: "thinking" });
	log?.("turn", `start_immediate turn=${turnId}`);
	turnRuntime.append(turn, reply);
	sendJson(ws, { type: "reply_delta", text: reply });
	sendJson(ws, { type: "done", reply });
	speakSentence(turn, reply);
	turnRuntime.markDone(turn);
	turnRuntime.completeIfReady(turn);
	turnRuntime.clearAbort(controller);
	return { turn, turnId };
}
