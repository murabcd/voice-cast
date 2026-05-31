import { describe, expect, it } from "vitest";
import {
	appendReply,
	canAcceptTurn,
	createTurn,
	finishSpeech,
	isTurnComplete,
	markLlmDone,
	queueSpeech,
} from "./turn-lifecycle.mjs";

describe("turn lifecycle", () => {
	it("waits for queued speech after the LLM is done", () => {
		const turn = createTurn({ id: 1, startedAt: 100, ws: {} });

		appendReply(turn, "First.");
		queueSpeech(turn);
		markLlmDone(turn);

		expect(isTurnComplete(turn)).toBe(false);
		expect(finishSpeech(turn)).toBe(0);
		expect(isTurnComplete(turn)).toBe(true);
	});

	it("tracks multiple speech requests and clamps extra finishes", () => {
		const turn = createTurn({ id: 2, startedAt: 100, ws: {} });

		expect(queueSpeech(turn)).toBe(1);
		expect(queueSpeech(turn)).toBe(2);
		expect(turn.pendingSpeech).toBe(2);
		expect(finishSpeech(turn)).toBe(1);
		expect(finishSpeech(turn)).toBe(0);
		expect(finishSpeech(turn)).toBe(0);
	});

	it("rejects stale turns after cancellation or replacement", () => {
		const oldTurn = createTurn({ id: 3, startedAt: 100, ws: {} });
		const newTurn = createTurn({ id: 4, startedAt: 200, ws: {} });

		expect(canAcceptTurn(oldTurn, oldTurn, 3)).toBe(true);
		expect(canAcceptTurn(newTurn, oldTurn, 4)).toBe(false);
		expect(canAcceptTurn(newTurn, newTurn, 3)).toBe(false);
	});
});
