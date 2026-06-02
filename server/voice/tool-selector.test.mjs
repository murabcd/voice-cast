import { describe, expect, it } from "vitest";
import { buildVoiceToolRegistry } from "../ai/tools/tool-registry.mjs";
import { selectToolsForTurn } from "./tool-selector.mjs";

function registry() {
	return buildVoiceToolRegistry({
		settings: { language: "ru", timeZone: "Europe/Moscow" },
		webTools: {
			enabled: true,
			tools: [
				{ name: "web_search", description: "search", parameters: {} },
				{ name: "web_fetch", description: "fetch", parameters: {} },
			],
			callTool: async () => ({}),
		},
	});
}

describe("tool selector", () => {
	it("selects deterministic local tools before web tools", () => {
		expect(
			selectToolsForTurn({
				text: "Сколько сейчас времени в Москве?",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_tool",
			category: "local_datetime",
			toolName: "current_time",
		});
	});

	it("selects direct web search for explicit or fresh external requests", () => {
		expect(
			selectToolsForTurn({
				text: "Зайди в интернет и найди компанию Фломни",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_web",
			toolNames: ["web_search"],
		});
		expect(
			selectToolsForTurn({
				text: "Какая сейчас погода в Москве?",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_web",
			toolNames: ["web_search"],
		});
	});

	it("keeps normal conversation on the LLM path without selected tools", () => {
		expect(
			selectToolsForTurn({
				text: "Привет, расскажи, что ты умеешь.",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "llm",
			toolNames: [],
		});
		expect(
			selectToolsForTurn({
				text: "Где купить билет, онлайн или в офисе?",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "llm",
			toolNames: [],
		});
	});

	it("forces web search for follow-ups after a web-grounded turn", () => {
		const webContext = {
			user: "Поищи компанию Flomni",
			assistant: "Нашёл информацию о Flomni.",
			metadata: { usedWeb: true, toolNames: ["web_search"] },
		};

		expect(
			selectToolsForTurn({
				text: "А цены актуальные?",
				registry: registry(),
				webContext,
			}),
		).toMatchObject({
			kind: "direct_web",
			category: "web_followup_mutable_fact",
			toolNames: ["web_search"],
			query: "Поищи компанию Flomni\nFollow-up: А цены актуальные?",
		});
		expect(
			selectToolsForTurn({
				text: "source?",
				registry: registry(),
				webContext,
			}),
		).toMatchObject({
			kind: "direct_web",
			category: "web_followup_reference",
			toolNames: ["web_search"],
		});
	});

	it("keeps ambiguous follow-ups after web turns local", () => {
		const webContext = {
			user: "Поищи компанию Flomni",
			assistant: "Нашёл информацию о Flomni.",
			metadata: { usedWeb: true, toolNames: ["web_search"] },
		};

		expect(
			selectToolsForTurn({
				text: "and?",
				registry: registry(),
				webContext,
			}),
		).toMatchObject({
			kind: "llm",
			toolNames: [],
		});
		expect(
			selectToolsForTurn({
				text: "а что?",
				registry: registry(),
				webContext,
			}),
		).toMatchObject({
			kind: "llm",
			toolNames: [],
		});
	});

	it("keeps pronunciation and meta follow-ups after web turns on the LLM path", () => {
		const webContext = {
			user: "Поищи информацию о компании Flomni",
			assistant: "Нашёл информацию о Flomni.",
			metadata: { usedWeb: true, toolNames: ["web_search"] },
		};

		expect(
			selectToolsForTurn({
				text: "what would you say?",
				registry: registry(),
				webContext,
			}),
		).toMatchObject({
			kind: "llm",
			toolNames: [],
		});
		expect(
			selectToolsForTurn({
				text: "как бы ты это произнес?",
				registry: registry(),
				webContext,
			}),
		).toMatchObject({
			kind: "none",
			category: "pronunciation_feedback",
		});
	});

	it("keeps local voice pipeline questions away from tools", () => {
		expect(
			selectToolsForTurn({
				text: "У тебя VAD detection не остановил речь",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "none",
			category: "system_debug",
		});
	});
});
