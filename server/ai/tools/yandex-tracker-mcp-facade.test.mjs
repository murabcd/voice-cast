import { describe, expect, it } from "vitest";
import { createYandexTrackerMcpFacade } from "./yandex-tracker-mcp-facade.mjs";

describe("Yandex Tracker MCP facade", () => {
	it("turns issue JSON into compact readable context", async () => {
		const facade = createYandexTrackerMcpFacade({
			enabled: true,
			tools: [
				{ name: "issue_get" },
				{ name: "issue_get_url" },
				{ name: "issue_get_comments" },
				{ name: "issues_find" },
			],
			callTool: async (name) => {
				if (name === "issue_get_url") {
					return {
						content: [
							{ type: "text", text: "https://tracker.yandex.ru/PROJ-4911" },
						],
					};
				}
				if (name === "issue_get_comments") {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify([
									{ text: "Нужно посмотреть варианты." },
									{
										text: "Решили сначала оценить доработку аналитики, затем вернуться к диалогам.",
									},
								]),
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								key: "PROJ-4911",
								summary: "Оценить доработку аналитики или диалогов",
								status: { display: "Открыт" },
								assignee: { display: "Мурад Абдулкадыров" },
								deadline: "2026-05-26T00:00:00.000Z",
								updated_at: "2026-05-27T19:37:28.608000Z",
								description: "Нужно понять, что быстрее даст пользу.",
							}),
						},
					],
				};
			},
		});

		const result = await facade.callTool("yandex_tracker_get_issue", {
			issueKey: "PROJ-4911",
		});

		expect(result.results).toEqual([
			{
				title: "PROJ-4911",
				content:
					"About: Оценить доработку аналитики или диалогов\nLatest decision: Решили сначала оценить доработку аналитики, затем вернуться к диалогам.\nContext: Нужно понять, что быстрее даст пользу.",
				sections: [
					{
						label: "About",
						text: "Оценить доработку аналитики или диалогов",
					},
					{
						label: "Latest decision",
						text: "Решили сначала оценить доработку аналитики, затем вернуться к диалогам.",
					},
					{ label: "Context", text: "Нужно понять, что быстрее даст пользу." },
				],
				url: "https://tracker.yandex.ru/PROJ-4911",
			},
		]);
		expect(result.sections).toEqual([
			{ label: "About", text: "Оценить доработку аналитики или диалогов" },
			{
				label: "Latest decision",
				text: "Решили сначала оценить доработку аналитики, затем вернуться к диалогам.",
			},
			{ label: "Context", text: "Нужно понять, что быстрее даст пользу." },
		]);
		expect(result.sources).toEqual([
			{ title: "PROJ-4911", url: "https://tracker.yandex.ru/PROJ-4911" },
		]);
	});

	it("does not expose sources when issue_get returns an MCP error", async () => {
		const calls = [];
		const facade = createYandexTrackerMcpFacade({
			enabled: true,
			tools: [
				{ name: "issue_get" },
				{ name: "issue_get_url" },
				{ name: "issues_find" },
			],
			callTool: async (name, args) => {
				calls.push({ name, args });
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: "Error executing tool issue_get: 401, message='Unauthorized'",
						},
					],
				};
			},
		});

		const result = await facade.callTool("yandex_tracker_get_issue", {
			issueKey: "PROJ-8508",
		});

		expect(calls).toEqual([
			{
				name: "issue_get",
				args: { issue_id: "PROJ-8508", include_description: true },
			},
		]);
		expect(result.sources).toBeUndefined();
		expect(result.error).toEqual({
			code: "unauthorized",
			message:
				"Yandex Tracker rejected the request with an authorization error. Check the Tracker token, organization ID, and queue access.",
		});
		expect(result.results).toEqual([
			{
				title: "PROJ-8508",
				content:
					"Yandex Tracker rejected the request with an authorization error. Check the Tracker token, organization ID, and queue access.",
			},
		]);
	});

	it("parses long issue payloads before compacting sections", async () => {
		const facade = createYandexTrackerMcpFacade({
			enabled: true,
			tools: [{ name: "issue_get" }],
			callTool: async () => ({
				content: [
					{
						type: "text",
						text: JSON.stringify({
							key: "PROJ-4911",
							created_at: "2026-05-20T11:11:26.962000Z",
							updated_at: "2026-05-27T19:37:28.608000Z",
							created_by: {
								display: "Диана Чиникайло",
								id: "1130000038771963",
							},
							updated_by: {
								display: "Диана Чиникайло",
								id: "1130000038771963",
							},
							summary: "Оценить доработку аналитики или диалогов",
							description: "x".repeat(2000),
						}),
					},
				],
			}),
		});

		const result = await facade.callTool("yandex_tracker_get_issue", {
			issueKey: "PROJ-4911",
		});

		expect(result.sections[0]).toEqual({
			label: "About",
			text: "Оценить доработку аналитики или диалогов",
		});
		expect(result.sections[1]).toMatchObject({ label: "Context" });
		expect(result.sections[1].text).toHaveLength(703);
		expect(result.sections[1].text).not.toContain("created_at");
	});

	it("uses structured MCP issue content when available", async () => {
		const facade = createYandexTrackerMcpFacade({
			enabled: true,
			tools: [{ name: "issue_get" }],
			callTool: async () => ({
				content: [],
				structuredContent: {
					key: "PROJ-4911",
					summary: "Оценить доработку аналитики или диалогов",
				},
			}),
		});

		const result = await facade.callTool("yandex_tracker_get_issue", {
			issueKey: "PROJ-4911",
		});

		expect(result.sections).toEqual([
			{ label: "About", text: "Оценить доработку аналитики или диалогов" },
		]);
	});

	it("uses structured MCP comments when available", async () => {
		const facade = createYandexTrackerMcpFacade({
			enabled: true,
			tools: [{ name: "issue_get" }, { name: "issue_get_comments" }],
			callTool: async (name) =>
				name === "issue_get_comments"
					? {
							content: [],
							structuredContent: {
								comments: [{ text: "Решили сначала проверить роли." }],
							},
						}
					: {
							content: [],
							structuredContent: {
								key: "PROJ-4911",
								summary: "Оценить доработку аналитики или диалогов",
							},
						},
		});

		const result = await facade.callTool("yandex_tracker_get_issue", {
			issueKey: "PROJ-4911",
		});

		expect(result.sections).toEqual([
			{ label: "About", text: "Оценить доработку аналитики или диалогов" },
			{ label: "Latest decision", text: "Решили сначала проверить роли." },
		]);
	});

	it("uses raw MCP comment envelopes when available", async () => {
		const facade = createYandexTrackerMcpFacade({
			enabled: true,
			tools: [{ name: "issue_get" }, { name: "issue_get_comments" }],
			callTool: async (name) =>
				name === "issue_get_comments"
					? {
							content: [
								{
									type: "text",
									text: JSON.stringify({
										comments: [
											{ text: "Нужно проверить роли." },
											{ text: "Решили сначала исправить права операторов." },
										],
									}),
								},
							],
						}
					: {
							content: [
								{
									type: "text",
									text: JSON.stringify({
										key: "PROJ-4507",
										summary: "Операторы не могут выбирать типы шаблонов",
									}),
								},
							],
						},
		});

		const result = await facade.callTool("yandex_tracker_get_issue", {
			issueKey: "PROJ-4507",
		});

		expect(result.sections).toEqual([
			{ label: "About", text: "Операторы не могут выбирать типы шаблонов" },
			{
				label: "Latest decision",
				text: "Решили сначала исправить права операторов.",
			},
		]);
	});

	it("fails when Tracker returns an invalid issue payload", async () => {
		const facade = createYandexTrackerMcpFacade({
			enabled: true,
			tools: [{ name: "issue_get" }],
			callTool: async () => ({
				content: [{ type: "text", text: '{"created_at":"truncated"' }],
			}),
		});

		await expect(
			facade.callTool("yandex_tracker_get_issue", {
				issueKey: "PROJ-4911",
			}),
		).rejects.toThrow("Tracker issue PROJ-4911 returned an invalid payload.");
	});

	it("rejects invalid issue arguments before calling MCP", async () => {
		const calls = [];
		const facade = createYandexTrackerMcpFacade({
			enabled: true,
			tools: [{ name: "issue_get" }],
			callTool: async (name, args) => {
				calls.push({ name, args });
				return { content: [] };
			},
		});

		await expect(
			facade.callTool("yandex_tracker_get_issue", {
				issueKey: 4911,
			}),
		).rejects.toThrow("Missing Yandex Tracker issue key.");
		expect(calls).toEqual([]);
	});
});
