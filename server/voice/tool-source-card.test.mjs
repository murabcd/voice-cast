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

	it("cleans markdown-like web snippets for display sections", () => {
		const summary = summarizeToolResults({
			calls: [{ name: "web_search", arguments: { query: "Flomni" } }],
			results: [
				{
					name: "web_search",
					result: {
						results: [
							{
								title: "Products | Flomni",
								content:
									"## Умные решения для автоматизации **коммуникаций** в вашей компании",
								url: "https://example.com/products",
							},
						],
					},
				},
			],
		});

		expect(summary.sections).toEqual([
			{
				label: "Key findings",
				text: "Умные решения для автоматизации коммуникаций в вашей компании",
			},
		]);
	});

	it("uses requested web fetch URLs as source identities", () => {
		const summary = summarizeToolResults({
			calls: [
				{ name: "web_fetch", arguments: { url: "https://hr.flomni.com" } },
			],
			results: [
				{
					name: "web_fetch",
					result: {
						title: "Pricing | Flomni",
						content: "Pricing page content.",
					},
				},
			],
		});

		expect(summary).toMatchObject({
			provider: "web",
			query: "https://hr.flomni.com",
			title: "Web results",
			tools: ["web_fetch"],
		});
		expect(summary.sources[0]).toEqual({
			title: "hr.flomni.com",
			url: "https://hr.flomni.com",
		});
	});

	it("keeps the requested fetch URL ahead of mismatched page titles", () => {
		const summary = summarizeToolResults({
			calls: [
				{ name: "web_fetch", arguments: { url: "https://hr.flomni.com" } },
			],
			results: [
				{
					name: "web_fetch",
					result: {
						title: "Dina Jordan",
						content: "Unrelated page content.",
					},
				},
			],
		});

		expect(summary.sources[0]).toEqual({
			title: "hr.flomni.com",
			url: "https://hr.flomni.com",
		});
		expect(summary.sources[1]).toEqual({ title: "Dina Jordan" });
	});

	it("keeps source-card display text separate from model context caps", () => {
		const longText = "Readable context. ".repeat(80);
		const summary = summarizeToolResults({
			calls: [{ name: "web_search", arguments: { query: "Flomni" } }],
			results: [
				{
					name: "web_search",
					result: {
						results: [
							{
								title: "Products | Flomni",
								content: longText,
								url: "https://example.com/products",
							},
						],
					},
				},
			],
		});

		expect(summary.sections[0].text).not.toContain("...");
		expect(summary.sections[0].text.length).toBeGreaterThan(700);
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
