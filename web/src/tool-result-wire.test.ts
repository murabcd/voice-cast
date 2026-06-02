import { describe, expect, it } from "vitest";
import {
	parseToolActivityProvider,
	parseToolResultSummary,
} from "./tool-result-wire";

describe("tool result wire parsing", () => {
	it("parses valid tool result summaries", () => {
		expect(
			parseToolResultSummary({
				id: "tool-1",
				provider: "yandex-tracker",
				results: [{ content: "Context", title: "PROJ-1" }],
				sections: [{ label: "About", text: "Fix role permissions" }],
				sources: [{ title: "PROJ-1", url: "https://tracker.yandex.ru/PROJ-1" }],
				summary: "About: Fix role permissions",
				title: "Tracker results",
				tools: ["yandex_tracker_get_issue"],
				type: "tool_result",
			}),
		).toMatchObject({
			provider: "yandex-tracker",
			sections: [{ label: "About", text: "Fix role permissions" }],
		});
	});

	it("rejects malformed tool result summaries", () => {
		expect(
			parseToolResultSummary({
				id: "tool-1",
				provider: "web",
				results: [{ content: "Context", title: "Result", url: "" }],
				sections: [],
				sources: [],
				summary: "",
				title: "Web results",
				tools: ["web_search"],
				type: "tool_result",
			}),
		).toBeNull();
	});

	it("parses tool activity provider from explicit provider or tool name", () => {
		expect(
			parseToolActivityProvider({
				active: true,
				provider: "yandex-tracker",
			}),
		).toBe("yandex-tracker");
		expect(
			parseToolActivityProvider({
				active: true,
				name: "web_search",
			}),
		).toBe("web");
		expect(
			parseToolActivityProvider({ active: false, name: "web_search" }),
		).toBe(null);
	});
});
