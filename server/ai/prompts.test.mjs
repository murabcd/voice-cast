import { describe, expect, it } from "vitest";
import { buildVoiceMessages } from "./prompts.mjs";

describe("voice prompts", () => {
	it("injects runtime capability context into the system message", () => {
		const messages = buildVoiceMessages({
			prompt: "Что ты умеешь?",
			systemPrompt: "Base prompt.",
			runtimeContext: "## Runtime Capabilities\nAvailable now:\n- local tools",
		});

		expect(messages[0]).toEqual({
			role: "system",
			content:
				"Base prompt.\n\n## Runtime Capabilities\nAvailable now:\n- local tools",
		});
	});
});
