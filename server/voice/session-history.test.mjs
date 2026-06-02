import { describe, expect, it } from "vitest";
import {
	createSessionHistory,
	isRepeatLastAnswerRequest,
	shouldRememberTurn,
} from "./session-history.mjs";

describe("session history", () => {
	it("keeps only user-facing turns as chat messages", () => {
		const history = createSessionHistory();

		history.add({
			user: "Что такое Flomni?",
			assistant: "Flomni помогает бизнесу автоматизировать коммуникации.",
		});

		expect(history.lastAssistant()).toBe(
			"Flomni помогает бизнесу автоматизировать коммуникации.",
		);
		expect(history.size()).toBe(1);
		expect(history.messages()).toEqual([
			{ role: "user", content: "Что такое Flomni?" },
			{
				role: "assistant",
				content: "Flomni помогает бизнесу автоматизировать коммуникации.",
			},
		]);
	});

	it("keeps recent turns compact", () => {
		const history = createSessionHistory();

		for (let index = 0; index < 6; index += 1) {
			history.add({
				user: `Вопрос ${index} ${"x".repeat(500)}`,
				assistant: `Ответ ${index} ${"y".repeat(500)}`,
			});
		}

		expect(history.size()).toBe(4);
		expect(history.messages()[0].content.startsWith("Вопрос 2")).toBe(true);
		expect(
			history.messages().every((message) => message.content.length <= 360),
		).toBe(true);
	});

	it("tracks the latest web-grounded turn without exposing metadata as chat text", () => {
		const history = createSessionHistory();

		history.add({
			user: "Поищи Flomni",
			assistant: "Нашёл краткое описание.",
			metadata: { usedWeb: true, toolNames: ["web_search"] },
		});
		history.add({
			user: "Спасибо",
			assistant: "Пожалуйста.",
		});

		expect(history.webContext()).toMatchObject({
			user: "Поищи Flomni",
			metadata: { usedWeb: true, toolNames: ["web_search"] },
		});
		expect(history.messages()).toEqual([
			{ role: "user", content: "Поищи Flomni" },
			{ role: "assistant", content: "Нашёл краткое описание." },
			{ role: "user", content: "Спасибо" },
			{ role: "assistant", content: "Пожалуйста." },
		]);
	});

	it("detects repeat requests", () => {
		expect(isRepeatLastAnswerRequest("Повтори еще, что ты сказал")).toBe(true);
		expect(isRepeatLastAnswerRequest("скажи ещё раз")).toBe(true);
		expect(isRepeatLastAnswerRequest("Что такое Flomni?")).toBe(false);
	});

	it("does not remember repeat, pronunciation, pipeline, or unclear-audio turns", () => {
		expect(
			shouldRememberTurn({
				user: "Повтори еще раз",
				assistant: "Последний ответ.",
			}),
		).toBe(false);
		expect(
			shouldRememberTurn({
				user: "Ты неправильно произнес ударение в слове багаж",
				assistant: "Понял, поправлю произношение.",
			}),
		).toBe(false);
		expect(
			shouldRememberTurn({
				user: "У тебя VAD detection не остановил речь",
				assistant: "Проверю поведение.",
			}),
		).toBe(false);
		expect(
			shouldRememberTurn({
				user: "I changing.",
				assistant: "Не расслышал. Повтори, пожалуйста, по-русски.",
			}),
		).toBe(false);
		expect(
			shouldRememberTurn({
				user: "Привет, что нового?",
				assistant:
					"Мы скоро обновим нашу систему поддержки и добавим новые функции для пользователей.",
			}),
		).toBe(false);
	});
});
