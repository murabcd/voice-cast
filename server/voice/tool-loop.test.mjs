import { describe, expect, it } from "vitest";
import { parseToolCalls } from "./tool-loop.mjs";

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
});
