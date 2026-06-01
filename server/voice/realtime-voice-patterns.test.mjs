import { describe, expect, it } from "vitest";
import {
	pickToolPreamble,
	shouldWaitForUser,
} from "./realtime-voice-patterns.mjs";

describe("realtime voice patterns", () => {
	it("waits on silence, filler, and background-noise transcripts", () => {
		expect(shouldWaitForUser("")).toBe(true);
		expect(shouldWaitForUser("эм")).toBe(true);
		expect(shouldWaitForUser("фоновый шум")).toBe(true);
		expect(shouldWaitForUser("silence")).toBe(true);
	});

	it("does not wait on real short questions", () => {
		expect(shouldWaitForUser("когда были первые пожарные")).toBe(false);
		expect(shouldWaitForUser("проверь сайт OpenAI")).toBe(false);
	});

	it("varies tool preambles by turn id", () => {
		expect(pickToolPreamble({ language: "ru", turnId: 1 })).not.toBe(
			pickToolPreamble({ language: "ru", turnId: 2 }),
		);
		expect(pickToolPreamble({ language: "en", turnId: 1 })).toMatch(
			/check|verify|look/i,
		);
	});
});
