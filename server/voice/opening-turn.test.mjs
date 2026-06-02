import { describe, expect, it } from "vitest";
import { openingReplyForSettings } from "./opening-turn.mjs";

describe("opening turn", () => {
	it("uses the selected language for the first spoken reply", () => {
		expect(openingReplyForSettings({ language: "en" })).toBe(
			"Hi, I am ready. What would you like to talk about?",
		);
		expect(openingReplyForSettings({ language: "ru" })).toBe(
			"Привет, я на связи. О чем поговорим?",
		);
	});

	it("defaults to Russian when settings are not ready", () => {
		expect(openingReplyForSettings({})).toBe(
			"Привет, я на связи. О чем поговорим?",
		);
	});
});
