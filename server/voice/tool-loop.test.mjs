import { describe, expect, it, vi } from "vitest";

vi.mock("./llama.mjs", () => ({
	completeLlamaReply: vi.fn(async () => "NO_TOOL"),
}));

import { completeLlamaReply } from "./llama.mjs";
import {
	parseToolCalls,
	prepareDirectToolResultMessages,
	prepareDirectWebFetchMessages,
	prepareToolAugmentedMessages,
	toolResultMessage,
} from "./tool-loop.mjs";

describe("SmolLM3 tool call parsing", () => {
	it("extracts XML-wrapped JSON tool calls", () => {
		expect(
			parseToolCalls(
				'<tool_call>{"name":"files__read","arguments":{"path":"/tmp/a.txt"}}</tool_call>',
			),
		).toEqual([
			{
				name: "files__read",
				arguments: { path: "/tmp/a.txt" },
			},
		]);
	});

	it("ignores malformed XML-wrapped tool calls", () => {
		expect(parseToolCalls('<tool_call>{"name":</tool_call>')).toEqual([]);
	});

	it("forces a direct web search when the model declines a selected web route", async () => {
		const calls = [];
		const messages = await prepareToolAugmentedMessages({
			llamaUrl: "http://127.0.0.1:18081",
			history: [],
			prompt: "What is the latest SmolLM3 release?",
			systemPrompt: "Answer briefly.",
			signal: new AbortController().signal,
			toolManager: {
				enabled: true,
				tools: [{ name: "web_search", description: "search", parameters: {} }],
				callTool: async (name, args) => {
					calls.push({ name, args });
					return {
						verified: true,
						reason: "matched",
						results: [{ title: "SmolLM3", content: "Fresh result." }],
					};
				},
			},
			maxTokens: 64,
			temperature: 0,
			topP: 1,
			repeatPenalty: 1,
			rounds: 1,
			decisionMaxTokens: 16,
		});

		expect(calls).toEqual([
			{
				name: "web_search",
				args: { query: "What is the latest SmolLM3 release?" },
			},
		]);
		expect(messages.at(-2).content).toContain("tool_results");
	});

	it("passes explicitly fetched page content to the final answer prompt", async () => {
		const calls = [];
		const messages = await prepareDirectWebFetchMessages({
			history: [],
			prompt: "Сколько стоят решения на hr.flomni.com?",
			systemPrompt: "Answer briefly.",
			runtimeContext: "",
			signal: new AbortController().signal,
			toolManager: {
				enabled: true,
				tools: [{ name: "web_fetch", description: "fetch", parameters: {} }],
				callTool: async (name, args) => {
					calls.push({ name, args });
					return {
						title: "Flomni HR",
						content: "Тарифы доступны по запросу через форму расчета.",
						links: [],
					};
				},
			},
			toolArguments: { url: "https://hr.flomni.com" },
		});

		expect(calls).toEqual([
			{ name: "web_fetch", args: { url: "https://hr.flomni.com" } },
		]);
		expect(messages.at(-2).content).toContain("Flomni HR");
		expect(messages.at(-2).content).toContain(
			"Тарифы доступны по запросу через форму расчета.",
		);
		expect(messages.at(-1).content).toContain("содержимого страницы");
	});

	it("keeps llama tool planning compact for MCP tools", async () => {
		completeLlamaReply.mockResolvedValueOnce("NO_TOOL");
		await prepareToolAugmentedMessages({
			llamaUrl: "http://127.0.0.1:18081",
			history: [],
			prompt: "Найди тикет 8508 в Яндекс Трекере.",
			systemPrompt: "Answer briefly.",
			signal: new AbortController().signal,
			toolManager: {
				enabled: true,
				tools: [
					{
						name: "issues_find",
						description: "x".repeat(1000),
						parameters: {
							properties: {
								query: { type: "string" },
								queue: { type: "string" },
							},
						},
					},
				],
				callTool: async () => {
					throw new Error("should not call tool");
				},
			},
			maxTokens: 64,
			temperature: 0,
			topP: 1,
			repeatPenalty: 1,
			rounds: 1,
			decisionMaxTokens: 16,
		});

		const decisionRequest = completeLlamaReply.mock.calls.at(-1)?.[0];
		const primerMessage = decisionRequest?.messages.find((message) =>
			message.content.includes("Доступные инструменты:"),
		);
		expect(decisionRequest).toBeDefined();
		expect(decisionRequest?.tools).toBeUndefined();
		expect(primerMessage?.content).toContain("xxx...");
		expect(primerMessage?.content).not.toContain("x".repeat(300));
	});

	it("deduplicates repeated model-planned tool calls before execution", async () => {
		completeLlamaReply.mockResolvedValueOnce(
			[
				'<tool_call>{"name":"files__read","arguments":{"path":"/tmp/a.txt","encoding":"utf8"}}</tool_call>',
				'<tool_call>{"name":"files__read","arguments":{"encoding":"utf8","path":"/tmp/a.txt"}}</tool_call>',
			].join("\n"),
		);
		const calls = [];

		await prepareToolAugmentedMessages({
			llamaUrl: "http://127.0.0.1:18081",
			history: [],
			prompt: "Read the file.",
			systemPrompt: "Answer briefly.",
			signal: new AbortController().signal,
			toolManager: {
				enabled: true,
				tools: [
					{
						name: "files__read",
						description: "read file",
						parameters: {
							properties: {
								path: { type: "string" },
								encoding: { type: "string" },
							},
						},
					},
				],
				callTool: async (name, args) => {
					calls.push({ name, args });
					return { verified: true, results: [{ content: "file body" }] };
				},
			},
			maxTokens: 64,
			temperature: 0,
			topP: 1,
			repeatPenalty: 1,
			rounds: 1,
			decisionMaxTokens: 64,
		});

		expect(calls).toEqual([
			{
				name: "files__read",
				args: { path: "/tmp/a.txt", encoding: "utf8" },
			},
		]);
	});

	it("keeps MCP no-tool planning sentinels out of final answer messages", async () => {
		completeLlamaReply.mockResolvedValueOnce("NO_TOOL");
		const messages = await prepareToolAugmentedMessages({
			llamaUrl: "http://127.0.0.1:18081",
			history: [],
			prompt: "Что последнее решили по тикету?",
			systemPrompt: "Answer briefly.",
			signal: new AbortController().signal,
			toolManager: {
				enabled: true,
				tools: [
					{
						name: "yandex_tracker_search",
						description: "search issues",
						parameters: {
							properties: {
								query: { type: "string" },
							},
						},
					},
				],
				callTool: async () => {
					throw new Error("should not call tool");
				},
			},
			maxTokens: 64,
			temperature: 0,
			topP: 1,
			repeatPenalty: 1,
			rounds: 1,
			decisionMaxTokens: 16,
		});

		const finalPrompt = messages.map((message) => message.content).join("\n");
		expect(finalPrompt).not.toContain("NO_TOOL");
		expect(finalPrompt).not.toContain("Доступные инструменты:");
		expect(messages.at(-1)?.content).toContain(
			"Подходящий инструмент не был вызван",
		);
	});

	it("keeps model-facing tool results compact and section-oriented", () => {
		const message = toolResultMessage([
			{
				arguments: { issueKey: "PROJ-4507" },
				name: "yandex_tracker_get_issue",
				result: {
					results: [
						{
							title: "PROJ-4507",
							content: "About: Operators cannot choose template types",
							url: "https://tracker.yandex.ru/PROJ-4507",
						},
					],
					sections: [
						{
							label: "About",
							text: "Operators cannot choose template types",
						},
						{
							label: "Context",
							text: "x".repeat(1200),
						},
					],
					sources: [
						{
							title: "PROJ-4507",
							url: "https://tracker.yandex.ru/PROJ-4507",
						},
					],
				},
			},
		]);

		expect(message).toContain('"sections"');
		expect(message).toContain('"sources":["PROJ-4507"]');
		expect(message).not.toContain("tracker.yandex.ru");
		expect(message).not.toContain("x".repeat(300));
	});

	it("tells the final model that non-empty Tracker sections mean the issue was found", async () => {
		const messages = await prepareDirectToolResultMessages({
			history: [],
			prompt: "Найди задачу 45.07",
			systemPrompt: "Answer briefly.",
			signal: new AbortController().signal,
			toolManager: {
				enabled: true,
				tools: [
					{
						name: "yandex_tracker_get_issue",
						description: "get issue",
						parameters: {},
					},
				],
				callTool: async () => ({
					results: [
						{
							title: "PROJ-4507",
							content: "About: Operators cannot choose template types",
						},
					],
					sections: [
						{
							label: "About",
							text: "Operators cannot choose template types",
						},
					],
					sources: [{ title: "PROJ-4507" }],
				}),
			},
			toolName: "yandex_tracker_get_issue",
			toolArguments: { issueKey: "PROJ-4507" },
		});

		expect(messages.at(-1)?.content).toContain("инструмент нашел задачу");
		expect(messages.at(-1)?.content).toContain("не читай Context дословно");
		expect(messages.at(-1)?.content).toContain("одном-двух предложениях");
		expect(messages.at(-2)?.content).toContain(
			"Operators cannot choose template types",
		);
	});
});
