import { describe, expect, it } from "vitest";
import { runtimeSessionContext } from "./session-context.mjs";

describe("session context", () => {
	it("builds dynamic voice session context from selected language", () => {
		const context = runtimeSessionContext({ language: "en" });

		expect(context).toContain("## Voice Session Context");
		expect(context).toContain("Reply in English");
		expect(context).toContain("Direct answers: 1-2 short sentences.");
		expect(context).toContain("Tool results: summarize the result first");
	});
});
