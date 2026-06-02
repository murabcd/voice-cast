import { describe, expect, it } from "vitest";
import {
	openingTurnPrompt,
	openingTurnRuntimeContext,
} from "./opening-turn.mjs";

describe("opening turn", () => {
	it("builds a constrained Russian first-greeting prompt", () => {
		const prompt = openingTurnPrompt({ language: "ru" });

		expect(prompt).toContain("голосовой разговор");
		expect(prompt).toContain("одним коротким предложением");
		expect(prompt).toContain("Не описывай инструменты");
		expect(prompt).toContain("Не утверждай, что уже знаешь задачу");
	});

	it("builds a constrained English first-greeting prompt", () => {
		const prompt = openingTurnPrompt({ language: "en" });

		expect(prompt).toContain("voice conversation");
		expect(prompt).toContain("one short sentence");
		expect(prompt).toContain("Do not describe tools");
		expect(prompt).toContain("Do not claim you already know");
	});

	it("keeps runtime context explicit that no user task exists yet", () => {
		expect(openingTurnRuntimeContext({ language: "ru" })).toContain(
			"Пользователь еще не дал задачу",
		);
		expect(openingTurnRuntimeContext({ language: "en" })).toContain(
			"There is no user task yet",
		);
	});
});
