import { describe, expect, it } from "vitest";
import { shouldUseWebTools } from "./web-intent.mjs";

describe("web intent gate", () => {
	it("routes explicit web requests to tools", () => {
		expect(
			shouldUseWebTools(
				"Зайди в интернет, найди информацию по компании Flone.",
			),
		).toBe(true);
		expect(shouldUseWebTools("look up latest Ollama web search docs")).toBe(
			true,
		);
	});

	it("keeps normal conversation on the fast path", () => {
		expect(shouldUseWebTools("Привет, расскажи, что ты умеешь.")).toBe(false);
		expect(shouldUseWebTools("Давай, расскажи про свою историю.")).toBe(false);
	});
});
