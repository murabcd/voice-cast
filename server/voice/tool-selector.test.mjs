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
		mcpTools: {
			enabled: true,
			tools: [
				{ name: "issue_get", description: "get issue", parameters: {} },
				{ name: "issue_get_url", description: "get issue URL", parameters: {} },
				{ name: "issues_find", description: "search issues", parameters: {} },
			],
			callTool: async () => ({}),
		},
		trackerDefaultQueue: "PROJ",
		trackerLimitQueues: "PROJ,SUPPORT",
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

	it("selects bounded MCP lookup tools for explicit tracker issue requests", () => {
		expect(
			selectToolsForTurn({
				text: "Найди в Яндекс Трекере задачу CAST-123",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_tool_result",
			category: "mcp_yandex_tracker_issue",
			toolName: "yandex_tracker_get_issue",
			arguments: { issueKey: "CAST-123" },
		});
	});

	it("normalizes bare tracker numbers through the configured default queue", () => {
		expect(
			selectToolsForTurn({
				text: "Найди в Яндекс Трекере тикет номер 8508",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_tool_result",
			category: "mcp_yandex_tracker_issue",
			toolName: "yandex_tracker_get_issue",
			arguments: { issueKey: "PROJ-8508" },
		});

		expect(
			selectToolsForTurn({
				text: "Посмотри в Яндекс Трекере контекст по задаче 85 .08.",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_tool_result",
			category: "mcp_yandex_tracker_issue",
			toolName: "yandex_tracker_get_issue",
			arguments: { issueKey: "PROJ-8508" },
		});

		expect(
			selectToolsForTurn({
				text: "Можешь посмотреть в Яндекс Трекере информацию по задаче сорок пять ноль семь.",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_tool_result",
			category: "mcp_yandex_tracker_issue",
			toolName: "yandex_tracker_get_issue",
			arguments: { issueKey: "PROJ-4507" },
		});
	});

	it("uses the default queue when STT emits an unknown queue-like token", () => {
		expect(
			selectToolsForTurn({
				text: "Там есть задача с номером Proge 8508.",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_tool_result",
			category: "mcp_yandex_tracker_issue",
			toolName: "yandex_tracker_get_issue",
			arguments: { issueKey: "PROJ-8508" },
		});

		expect(
			selectToolsForTurn({
				text: "Мог бы ты проверить по задаче Pro 91 в Яндекс Трекере?",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_tool_result",
			category: "mcp_yandex_tracker_issue",
			toolName: "yandex_tracker_get_issue",
			arguments: { issueKey: "PROJ-91" },
		});
	});

	it("preserves known non-default tracker queues", () => {
		expect(
			selectToolsForTurn({
				text: "Проверь задачу SUPPORT 91 в Яндекс Трекере",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_tool_result",
			category: "mcp_yandex_tracker_issue",
			toolName: "yandex_tracker_get_issue",
			arguments: { issueKey: "SUPPORT-91" },
		});

		expect(
			selectToolsForTurn({
				text: "Проверь SUPPORT номер девять один в Яндекс Трекере",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "direct_tool_result",
			category: "mcp_yandex_tracker_issue",
			toolName: "yandex_tracker_get_issue",
			arguments: { issueKey: "SUPPORT-91" },
		});
	});

	it("selects bounded MCP search tools for tracker search requests", () => {
		expect(
			selectToolsForTurn({
				text: "Поищи в Яндекс Трекере задачи по TikTok",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "tool_assisted_llm",
			category: "mcp_yandex_tracker",
			toolNames: ["yandex_tracker_search"],
		});
	});

	it("selects bounded MCP metadata tools for tracker queue requests", () => {
		expect(
			selectToolsForTurn({
				text: "Покажи очереди в Яндекс Трекере",
				registry: registry(),
			}),
		).toMatchObject({
			kind: "tool_assisted_llm",
			category: "mcp_yandex_tracker",
			toolNames: ["yandex_tracker_search"],
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
