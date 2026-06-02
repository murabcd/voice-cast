import { describe, expect, it } from "vitest";
import { summarizeToolResults } from "./tool-source-card.mjs";

describe("tool source cards", () => {
	it("prefers structured sections returned by a tool adapter", () => {
		const summary = summarizeToolResults({
			calls: [
				{ name: "yandex_tracker_get_issue", arguments: { issueKey: "PROJ-1" } },
			],
			results: [
				{
					name: "yandex_tracker_get_issue",
					result: {
						results: [
							{
								title: "PROJ-1",
								content: "About: Fix roles",
								url: "https://tracker.yandex.ru/PROJ-1",
							},
						],
						sections: [
							{ label: "About", text: "Fix roles" },
							{ label: "Latest decision", text: "Check AR permissions first." },
						],
						sources: [
							{ title: "PROJ-1", url: "https://tracker.yandex.ru/PROJ-1" },
						],
					},
				},
			],
		});

		expect(summary).toMatchObject({
			provider: "yandex-tracker",
			query: undefined,
			sections: [
				{ label: "About", text: "Fix roles" },
				{ label: "Latest decision", text: "Check AR permissions first." },
			],
			sources: [{ title: "PROJ-1", url: "https://tracker.yandex.ru/PROJ-1" }],
			title: "Tracker results",
			tools: ["yandex_tracker_get_issue"],
		});
	});

	it("builds key findings for web search without UI parsing", () => {
		const summary = summarizeToolResults({
			calls: [{ name: "web_search", arguments: { query: "SmolLM latest" } }],
			results: [
				{
					name: "web_search",
					result: {
						results: [
							{
								title: "SmolLM",
								content: "Fresh public result.",
								url: "https://example.com/smollm",
							},
						],
					},
				},
			],
		});

		expect(summary).toMatchObject({
			provider: "web",
			query: "SmolLM latest",
			sections: [{ label: "Key findings", text: "Fresh public result." }],
			sources: [{ title: "SmolLM", url: "https://example.com/smollm" }],
			title: "Web results",
			tools: ["web_search"],
		});
	});

	it("does not synthesize Tracker sections without adapter-owned sections", () => {
		const summary = summarizeToolResults({
			calls: [
				{ name: "yandex_tracker_get_issue", arguments: { issueKey: "PROJ-1" } },
			],
			results: [
				{
					name: "yandex_tracker_get_issue",
					result: {
						results: [{ title: "PROJ-1", content: '{"raw":"payload"}' }],
					},
				},
			],
		});

		expect(summary).toMatchObject({
			provider: "yandex-tracker",
			sections: [],
			title: "Tracker results",
		});
	});
});
