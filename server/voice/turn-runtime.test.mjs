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

	it("runs completion hooks after speech is finished and before turn_done", () => {
		const completed = [];
		const { runtime } = createRuntime();
		const ws = createOpenWs();
		const { turn } = runtime.begin({
			createLogEvent: () => ({ event: "voice_turn" }),
			startedAt: 100,
			transcript: "switch",
			ws,
		});
		turn.onComplete = (_turn, reply) => {
			completed.push(reply);
			ws.sent.push({ type: "character_handoff", characterId: 3 });
		};

		runtime.append(turn, "Переключаю на Disco Robot.");
		runtime.queue(turn);
		runtime.markDone(turn);

		expect(runtime.completeIfReady(turn)).toBe(false);
		runtime.finishQueuedSpeech(turn);
		expect(runtime.completeIfReady(turn)).toBe(true);
		expect(completed).toEqual(["Переключаю на Disco Robot."]);
		expect(ws.sent).toEqual([
			{ type: "character_handoff", characterId: 3 },
			{ reply: "Переключаю на Disco Robot.", type: "turn_done" },
			{ phase: "hearing", type: "state" },
		]);
	});

	it("runs after-completion hooks after the turn is cleared", () => {
		const events = [];
		const { runtime } = createRuntime();
		const ws = createOpenWs();
		const { turn } = runtime.begin({
			createLogEvent: () => ({ event: "voice_turn" }),
			startedAt: 100,
			transcript: "switch",
			ws,
		});
		turn.onAfterComplete = (completedTurn, reply) => {
			events.push({
				acceptsCompletedTurn: runtime.accepts(completedTurn),
				reply,
			});
		};

		runtime.append(turn, "Done.");
		runtime.markDone(turn);

		expect(runtime.completeIfReady(turn)).toBe(true);
		expect(events).toEqual([{ acceptsCompletedTurn: false, reply: "Done." }]);
	});

	it("can advance the next turn id without cancelling audio", () => {
		const { runtime, ttsCancels } = createRuntime();
		const first = runtime.begin({
			createLogEvent: () => ({ event: "voice_turn" }),
			startedAt: 100,
			transcript: "first",
			ws: createOpenWs(),
		});
		runtime.append(first.turn, "Done.");
		runtime.markDone(first.turn);
		expect(runtime.completeIfReady(first.turn)).toBe(true);

		runtime.beginNextTurn();
		const second = runtime.begin({
			createLogEvent: () => ({ event: "voice_turn" }),
			startedAt: 200,
			transcript: "second",
			ws: createOpenWs(),
		});

		expect(second.turnId).toBe(first.turnId + 1);
		expect(ttsCancels).toEqual([]);
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
