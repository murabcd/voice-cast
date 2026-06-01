import { describe, expect, it } from "vitest";
import {
	classifyAssistantTurn,
	classifyUserTurn,
	shouldStoreTurnType,
} from "./turn-classifier.mjs";

describe("turn classifier", () => {
	it("classifies non-conversation user turns", () => {
		expect(classifyUserTurn("У тебя VAD detection не остановил речь")).toBe(
			"system_debug",
		);
		expect(classifyUserTurn("Ты неправильно произнес ударение")).toBe(
			"pronunciation_feedback",
		);
		expect(classifyUserTurn("Привет, что нового?")).toBe("conversation");
	});

	it("classifies non-conversation assistant turns", () => {
		expect(
			classifyAssistantTurn("Не расслышал. Повтори, пожалуйста, по-русски."),
		).toBe("clarification");
		expect(
			classifyAssistantTurn(
				"Мы скоро обновим нашу систему поддержки и добавим новые функции.",
			),
		).toBe("unsupported_identity_claim");
		expect(classifyAssistantTurn("Привет, я слушаю.")).toBe("conversation");
	});

	it("allows only durable turn types into history", () => {
		expect(shouldStoreTurnType("conversation")).toBe(true);
		expect(shouldStoreTurnType("tool_result")).toBe(true);
		expect(shouldStoreTurnType("system_debug")).toBe(false);
		expect(shouldStoreTurnType("clarification")).toBe(false);
	});
});
