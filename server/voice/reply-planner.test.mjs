import { describe, expect, it } from "vitest";
import { planReply } from "./reply-planner.mjs";

const config = {
	llamaUrl: "http://127.0.0.1:18081",
	llama: {
		maxTokens: 64,
		repeatPenalty: 1,
		temperature: 0.2,
		toolDecisionMaxTokens: 32,
		toolRounds: 1,
		topP: 0.9,
	},
};

describe("tool planning policy", () => {
	it("emits tool activity through one event seam for direct local tools", async () => {
		const events = [];
		const reply = await planReply({
			config,
			history: [],
			prompt: "Сколько сейчас времени в Москве?",
			settings: {
				language: "ru",
				timeZone: "Europe/Moscow",
				webToolsEnabled: true,
			},
			signal: new AbortController().signal,
			toolManager: {
				enabled: false,
				tools: [],
				callTool: async () => {
					throw new Error("web tools should not be called");
				},
			},
			turnId: 1,
			onEvent: (event) => events.push(event),
		});

		expect(reply).toMatchObject({
			kind: "direct_reply",
			toolName: "current_time",
		});
		expect(events).toEqual([
			{ type: "tool_activity", active: true, name: "current_time" },
			{ type: "tool_activity", active: false, name: "current_time" },
		]);
	});
});
