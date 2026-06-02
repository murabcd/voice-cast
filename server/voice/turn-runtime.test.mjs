import { describe, expect, it } from "vitest";
import { createTurnRuntime } from "./turn-runtime.mjs";

function createRuntime() {
	const history = [];
	const sentToolStates = [];
	const ttsCancels = [];
	const runtime = createTurnRuntime({
		addHistory: (_ws, item) => history.push(item),
		log: () => undefined,
		resetToolActivity: ({ sendToolState }) =>
			sendToolState({ active: false, name: "web_search" }),
		sendToolState: (_ws, state) => sentToolStates.push(state),
		setHearing: (ws) => ws.sent.push({ type: "state", phase: "hearing" }),
		tts: { cancel: (reason) => ttsCancels.push(reason) },
	});
	return { history, runtime, sentToolStates, ttsCancels };
}

function createOpenWs() {
	return {
		readyState: 1,
		sent: [],
		send(payload) {
			this.sent.push(JSON.parse(payload));
		},
	};
}

describe("turn runtime", () => {
	it("waits for queued speech after the LLM is done", () => {
		const { runtime } = createRuntime();
		const ws = createOpenWs();
		const { turn } = runtime.begin({
			createLogEvent: () => ({}),
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
	});

	it("tracks multiple speech requests and clamps extra finishes", () => {
		const { runtime } = createRuntime();
		const { turn } = runtime.begin({
			createLogEvent: () => ({}),
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

	it("rejects stale turns after cancellation or replacement", () => {
		const { runtime } = createRuntime();
		const oldTurn = runtime.begin({
			createLogEvent: () => ({}),
			startedAt: 100,
			transcript: "old",
			ws: createOpenWs(),
		}).turn;

		expect(runtime.accepts(oldTurn)).toBe(true);
		runtime.cancel("replacement");
		expect(runtime.accepts(oldTurn)).toBe(false);

		const newTurn = runtime.begin({
			createLogEvent: () => ({}),
			startedAt: 200,
			transcript: "new",
			ws: createOpenWs(),
		}).turn;

		expect(runtime.accepts(oldTurn)).toBe(false);
		expect(runtime.accepts(newTurn)).toBe(true);
	});
});
