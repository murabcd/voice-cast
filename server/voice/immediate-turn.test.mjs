import { describe, expect, it } from "vitest";
import { startImmediateTurn } from "./immediate-turn.mjs";
import { createTurnRuntime } from "./turn-runtime.mjs";
import { sendJson } from "./wire.mjs";

function createOpenWs() {
	return {
		OPEN: 1,
		readyState: 1,
		sent: [],
		send(payload) {
			this.sent.push(JSON.parse(payload));
		},
	};
}

function createRuntime() {
	const history = [];
	const spoken = [];
	const runtime = createTurnRuntime({
		addHistory: (_ws, item) => history.push(item),
		emitTurnLog: () => undefined,
		log: () => undefined,
		resetToolActivity: () => undefined,
		sendToolState: () => undefined,
		setHearing: (ws) => ws.sent.push({ type: "state", phase: "hearing" }),
		tts: { cancel: () => undefined },
	});
	return { history, runtime, spoken };
}

describe("immediate turn", () => {
	it("sends and speaks a complete immediate reply", () => {
		const { history, runtime, spoken } = createRuntime();
		const ws = createOpenWs();

		const { turnId } = startImmediateTurn({
			commitHistory: false,
			createLogEvent: () => ({ event: "voice_turn", tool_names: [] }),
			reply: "Привет.",
			sendJson,
			speakSentence: (_turn, sentence) => spoken.push(sentence),
			startedAt: 100,
			transcript: "[server opening]",
			turnRuntime: runtime,
			ws,
		});

		expect(turnId).toBe(0);
		expect(spoken).toEqual(["Привет."]);
		expect(history).toEqual([]);
		expect(ws.sent).toEqual([
			{ phase: "thinking", type: "state" },
			{ text: "Привет.", type: "reply_delta" },
			{ reply: "Привет.", type: "done" },
			{ reply: "Привет.", type: "turn_done" },
			{ phase: "hearing", type: "state" },
		]);
	});
});
