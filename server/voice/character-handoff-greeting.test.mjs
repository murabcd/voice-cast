import { describe, expect, it } from "vitest";
import {
	characterHandoffGreetingPrompt,
	characterHandoffRuntimeContext,
} from "./character-handoff-greeting.mjs";

describe("character handoff greeting context", () => {
	it("builds a receiving-character greeting prompt with transfer context", () => {
		const prompt = characterHandoffGreetingPrompt({
			handoff: {
				conversation_context: "Бабушка приняла запрос на переключение.",
				from_character_name: "Бабушка",
				open_task: "Поздороваться и продолжить.",
				rationale_for_transfer:
					"Пользователь явно попросил переключить разговор на персонажа Принцесса.",
				to_character_name: "Принцесса",
				user_request: "Слышишь, зови принцесса.",
			},
			language: "ru",
		});

		expect(prompt).toContain("Ты теперь активный персонаж");
		expect(prompt).toContain("Предыдущий персонаж: Бабушка.");
		expect(prompt).toContain("Новый персонаж: Принцесса.");
		expect(prompt).toContain(
			"Запрос пользователя на переключение: Слышишь, зови принцесса.",
		);
		expect(prompt).toContain("Причина передачи:");
		expect(prompt).toContain("Контекст разговора:");
		expect(prompt).toContain("одним коротким предложением");
	});

	it("builds compact runtime context for the receiving character", () => {
		const context = characterHandoffRuntimeContext({
			handoff: {
				conversation_context: "Disco Robot accepted the transfer.",
				from_character_name: "Disco Robot",
				open_task: "Greet and continue.",
				rationale_for_transfer:
					"The user explicitly asked to switch to Hacker Grandma.",
				to_character_name: "Hacker Grandma",
				user_request: "call grandma",
			},
			language: "en",
		});

		expect(context).toContain("## Handoff Context");
		expect(context).toContain(
			"The previous character transferred the user to Hacker Grandma.",
		);
		expect(context).toContain("Previous character: Disco Robot.");
		expect(context).toContain("User request: call grandma.");
		expect(context).toContain(
			"Rationale: The user explicitly asked to switch to Hacker Grandma.",
		);
		expect(context).toContain("Conversation context: Disco Robot accepted");
		expect(context).toContain("Open task: Greet and continue.");
	});
});
