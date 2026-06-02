import { describe, expect, it } from "vitest";
import { webTaskFromTurnLog } from "./web-task-state.mjs";

describe("web task state", () => {
	it("captures explicit page fetches as durable web task state", () => {
		expect(
			webTaskFromTurnLog({
				tool_names: ["web_fetch"],
				tool_route_arguments: { url: "https://hr.flomni.com" },
				transcript: "Зайди на hr.flomni.com",
			}),
		).toEqual({
			kind: "page",
			query: "Зайди на hr.flomni.com",
			tool: "web_fetch",
			url: "https://hr.flomni.com",
		});
	});

	it("captures web searches as durable web task state", () => {
		expect(
			webTaskFromTurnLog({
				tool_names: ["web_search"],
				tool_route_query: "Flomni pricing",
				transcript: "Поищи цены Flomni",
			}),
		).toEqual({
			kind: "search",
			query: "Flomni pricing",
			tool: "web_search",
		});
	});
});
