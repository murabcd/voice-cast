import { describe, expect, it } from "vitest";
import { createTurnRuntime } from "./turn-runtime.mjs";

function createRuntime() {
	const history = [];
	const turnLogs = [];
	const sentToolStates = [];
	const ttsCancels = [];
	const runtime = createTurnRuntime({
		addHistory: (_ws, item) => history.push(item),
		emitTurnLog: (turn, outcome, fields = {}) =>
			turnLogs.push({ fields, outcome, turnId: turn.id }),
		log: () => undefined,
		resetToolActivity: ({ sendToolState }) =>
			sendToolState({ active: false, name: "web_search" }),
		sendToolState: (_ws, state) => sentToolStates.push(state),
		setHearing: (ws) => ws.sent.push({ type: "state", phase: "hearing" }),
		tts: { cancel: (reason) => ttsCancels.push(reason) },
	});
	return { history, runtime, sentToolStates, ttsCancels, turnLogs };
}

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

describe("turn runtime", () => {
	it("waits for queued speech after the LLM is done", () => {
		const { history, runtime, turnLogs } = createRuntime();
		const ws = createOpenWs();
		const { turn } = runtime.begin({
			createLogEvent: () => ({ event: "voice_turn" }),
			startedAt: 100,
			transcript: "hello",
			ws,
		});

		runtime.append(turn, "First.");
		runtime.queue(turn);
		runtime.markDone(turn);

		expect(runtime.completeIfReady(turn)).toBe(false);
		expect(runtime.finishQueuedSpeech(turn)).toBe(0);
		expect(runtime.completeIfReady(turn)).toBe(true);
		expect(history).toEqual([
			{
				assistant: "First.",
				metadata: { toolNames: [], usedWeb: false },
				user: "hello",
			},
		]);
		expect(turnLogs).toEqual([{ fields: {}, outcome: "success", turnId: 0 }]);
	});

	it("tracks multiple speech requests and clamps extra finishes", () => {
		const { runtime } = createRuntime();
		const { turn } = runtime.begin({
			createLogEvent: () => ({ event: "voice_turn" }),
			startedAt: 100,
			transcript: "hello",
			ws: createOpenWs(),
		});

		expect(runtime.queue(turn)).toBe(1);
		expect(runtime.queue(turn)).toBe(2);
		expect(turn.pendingSpeech).toBe(2);
		expect(runtime.finishQueuedSpeech(turn)).toBe(1);
		expect(runtime.finishQueuedSpeech(turn)).toBe(0);
		expect(runtime.finishQueuedSpeech(turn)).toBe(0);
	});

	it("can complete synthetic turns without committing them to history", () => {
		const { history, runtime } = createRuntime();
		const ws = createOpenWs();
		const { turn } = runtime.begin({
			commitHistory: false,
			createLogEvent: () => ({ event: "voice_turn" }),
			startedAt: 100,
			transcript: "[server opening]",
			ws,
		});

		runtime.append(turn, "Привет.");
		runtime.markDone(turn);

		expect(runtime.completeIfReady(turn)).toBe(true);
		expect(history).toEqual([]);
		expect(ws.sent).toEqual([
			{ reply: "Привет.", type: "turn_done" },
			{ phase: "hearing", type: "state" },
		]);
	});

	it("rejects stale turns after cancellation or replacement", () => {
		const { runtime, turnLogs, ttsCancels } = createRuntime();
		const oldTurn = runtime.begin({
			createLogEvent: () => ({ event: "voice_turn" }),
			startedAt: 100,
			transcript: "old",
			ws: createOpenWs(),
		}).turn;

		expect(runtime.accepts(oldTurn)).toBe(true);
		expect(runtime.hasActive()).toBe(true);
		runtime.cancel("replacement");
		expect(runtime.hasActive()).toBe(false);
		expect(runtime.accepts(oldTurn)).toBe(false);
		expect(ttsCancels).toEqual(["replacement"]);
		expect(turnLogs).toEqual([
			{
				fields: { cancel_reason: "replacement" },
				outcome: "cancelled",
				turnId: 0,
			},
		]);

		const newTurn = runtime.begin({
			createLogEvent: () => ({ event: "voice_turn" }),
			startedAt: 200,
			transcript: "new",
			ws: createOpenWs(),
		}).turn;

		expect(runtime.accepts(oldTurn)).toBe(false);
		expect(runtime.accepts(newTurn)).toBe(true);
	});
});
