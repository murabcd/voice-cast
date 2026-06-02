import { describe, expect, it, vi } from "vitest";

vi.mock("./llama.mjs", () => ({
	completeLlamaReply: vi.fn(async () => "NO_TOOL"),
}));

import { parseToolCalls, prepareToolAugmentedMessages } from "./tool-loop.mjs";

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
		expect(messages.at(-2).content).toContain("web_tool_results");
	});
});
