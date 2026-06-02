import { z } from "zod";

const trackerIssueArgsSchema = z
	.object({
		issueKey: z
			.string()
			.trim()
			.min(1)
			.transform((value) => value.toUpperCase()),
	})
	.strict();

const trackerSearchArgsSchema = z
	.object({
		query: z.string().trim().min(1),
	})
	.strict();

const trackerIssueSchema = z
	.object({
		description: z.unknown().optional(),
		key: z.string().optional(),
		summary: z.string().optional(),
	})
	.passthrough();

const trackerCommentSchema = z
	.object({
		body: z.unknown().optional(),
		comment: z.unknown().optional(),
		content: z.unknown().optional(),
		description: z.unknown().optional(),
		text: z.unknown().optional(),
	})
	.passthrough();

const trackerCommentsSchema = z.array(trackerCommentSchema);

const trackerCommentEnvelopeSchema = z
	.object({
		comments: trackerCommentsSchema.optional(),
		items: trackerCommentsSchema.optional(),
		results: trackerCommentsSchema.optional(),
	})
	.passthrough();

const structuredObjectSchema = z.object({}).passthrough();

function compactText(value, maxLength = 900) {
	const text = String(value ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength)}...`;
}

function firstText(result) {
	if (!Array.isArray(result?.content)) return "";
	for (const item of result.content) {
		if (item?.type === "text" && item.text) return compactText(item.text, 1200);
		if (item?.type === "resource" && item.resource?.text) {
			return compactText(item.resource.text, 1200);
		}
	}
	return compactText(JSON.stringify(result), 1200);
}

function firstRawText(result) {
	if (!Array.isArray(result?.content)) return JSON.stringify(result);
	for (const item of result.content) {
		if (item?.type === "text" && item.text) return String(item.text);
		if (item?.type === "resource" && item.resource?.text) {
			return String(item.resource.text);
		}
	}
	return JSON.stringify(result);
}

function allText(result, maxLength = 4000) {
	if (!Array.isArray(result?.content))
		return compactText(JSON.stringify(result), maxLength);
	const chunks = [];
	for (const item of result.content) {
		if (item?.type === "text" && item.text) chunks.push(item.text);
		if (item?.type === "resource" && item.resource?.text) {
			chunks.push(item.resource.text);
		}
	}
	return compactText(chunks.join("\n"), maxLength);
}

function firstUrl(result) {
	const text = firstText(result);
	const match = /https?:\/\/\S+/i.exec(text);
	return match?.[0]?.replace(/[),.;]+$/, "");
}

function parseJsonText(value) {
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

function structuredObject(result) {
	return structuredObjectSchema.safeParse(result?.structuredContent).data;
}

function structuredComments(result) {
	const parsed = trackerCommentEnvelopeSchema.safeParse(
		structuredObject(result),
	);
	if (!parsed.success) return undefined;
	return parsed.data.comments ?? parsed.data.items ?? parsed.data.results;
}

function parseComments(value) {
	const parsedValue = typeof value === "string" ? parseJsonText(value) : value;
	const parsedComments = trackerCommentsSchema.safeParse(parsedValue);
	if (parsedComments.success) return parsedComments.data;
	const parsedEnvelope = trackerCommentEnvelopeSchema.safeParse(parsedValue);
	if (!parsedEnvelope.success) return [];
	return (
		parsedEnvelope.data.comments ??
		parsedEnvelope.data.items ??
		parsedEnvelope.data.results ??
		[]
	);
}

function stripTrackerMarkup(value) {
	return compactText(
		String(value ?? "")
			.replaceAll(/\{\{([^}]+)\}\}/g, "$1")
			.replaceAll(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, "$2")
			.replaceAll(/<[^>]+>/g, " ")
			.replaceAll(/[*_`#>~-]+/g, " "),
		700,
	);
}

function commentText(comment) {
	return stripTrackerMarkup(
		comment.text ??
			comment.comment ??
			comment.body ??
			comment.description ??
			comment.content,
	);
}

function latestCommentText(value) {
	const comments = parseComments(value);
	for (const comment of [...comments].reverse()) {
		const text = commentText(comment);
		if (text) return compactText(text, 420);
	}
	return "";
}

function normalizeIssuePayload(issueKey, value, comments = "") {
	const parsedIssue = trackerIssueSchema.safeParse(
		typeof value === "string" ? parseJsonText(value) : value,
	);
	if (!parsedIssue.success) {
		throw new Error(`Tracker issue ${issueKey} returned an invalid payload.`);
	}
	const issue = parsedIssue.data;
	const key = compactText(issue.key ?? issueKey, 80);
	const summary = compactText(issue.summary, 220);
	const description = stripTrackerMarkup(issue.description);
	const latestDecision = latestCommentText(comments);
	const sections = [
		summary ? { label: "About", text: summary } : undefined,
		latestDecision
			? { label: "Latest decision", text: latestDecision }
			: undefined,
		description ? { label: "Context", text: description } : undefined,
	].filter(Boolean);
	return {
		content: sections
			.map((section) => `${section.label}: ${section.text}`)
			.join("\n"),
		sections,
		title: key || issueKey,
	};
}

function isToolError(result) {
	return result?.isError === true;
}

function classifyToolError(result) {
	const text = firstText(result);
	if (/\b401\b|unauthorized/i.test(text)) return "unauthorized";
	if (/\b403\b|forbidden/i.test(text)) return "forbidden";
	if (/\b404\b|not found/i.test(text)) return "not_found";
	return "tool_error";
}

function readableToolError(code) {
	if (code === "unauthorized")
		return "Yandex Tracker rejected the request with an authorization error. Check the Tracker token, organization ID, and queue access.";
	if (code === "forbidden")
		return "Yandex Tracker rejected the request because the token does not have access to this issue or queue.";
	if (code === "not_found") return "Yandex Tracker did not find this issue.";
	return "Yandex Tracker returned an error while reading the issue.";
}

function hasMcpTool(mcpTools, name) {
	return (mcpTools?.tools ?? []).some((tool) => tool.name === name);
}

export function createYandexTrackerMcpFacade(mcpTools) {
	const canGetIssue = hasMcpTool(mcpTools, "issue_get");
	const canGetIssueUrl = hasMcpTool(mcpTools, "issue_get_url");
	const canGetIssueComments = hasMcpTool(mcpTools, "issue_get_comments");
	const canSearch = hasMcpTool(mcpTools, "issues_find");
	const tools = [];

	if (canGetIssue) {
		tools.push({
			name: "yandex_tracker_get_issue",
			description: "Fetch one Yandex Tracker issue by full issue key.",
			parameters: {
				type: "object",
				properties: {
					issueKey: {
						type: "string",
						description: "Full Yandex Tracker issue key.",
					},
				},
				required: ["issueKey"],
				additionalProperties: false,
			},
			namespace: "mcp",
			execution: "remote",
			provider: "yandex-tracker",
		});
	}

	if (canSearch) {
		tools.push({
			name: "yandex_tracker_search",
			description: "Search Yandex Tracker issues with a compact Tracker query.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Tracker query.",
					},
				},
				required: ["query"],
				additionalProperties: false,
			},
			namespace: "mcp",
			execution: "remote",
			provider: "yandex-tracker",
		});
	}

	return {
		enabled: Boolean(mcpTools?.enabled && tools.length > 0),
		tools,
		async callTool(name, args, { signal } = {}) {
			if (name === "yandex_tracker_get_issue") {
				const parsedArgs = trackerIssueArgsSchema.safeParse(args);
				if (!parsedArgs.success) {
					throw new Error("Missing Yandex Tracker issue key.");
				}
				const { issueKey } = parsedArgs.data;
				const issueResult = await mcpTools.callTool(
					"issue_get",
					{ issue_id: issueKey, include_description: true },
					{ signal },
				);
				if (isToolError(issueResult)) {
					const code = classifyToolError(issueResult);
					return {
						error: {
							code,
							message: readableToolError(code),
						},
						results: [
							{
								title: issueKey,
								content: readableToolError(code),
							},
						],
					};
				}
				const urlResult = canGetIssueUrl
					? await mcpTools.callTool(
							"issue_get_url",
							{ issue_id: issueKey },
							{ signal },
						)
					: undefined;
				const url = firstUrl(urlResult);
				const commentsResult = canGetIssueComments
					? await mcpTools.callTool(
							"issue_get_comments",
							{ issue_id: issueKey },
							{ signal },
						)
					: undefined;
				const issue = normalizeIssuePayload(
					issueKey,
					structuredObject(issueResult) ?? firstRawText(issueResult),
					commentsResult && !isToolError(commentsResult)
						? (structuredComments(commentsResult) ?? allText(commentsResult))
						: "",
				);
				return {
					results: [
						{
							title: issue.title,
							content: issue.content,
							sections: issue.sections,
							url,
						},
					],
					sections: issue.sections,
					sources: url
						? [{ title: issue.title, url }]
						: [{ title: issue.title }],
				};
			}

			if (name === "yandex_tracker_search") {
				const parsedArgs = trackerSearchArgsSchema.safeParse(args);
				if (!parsedArgs.success) {
					throw new Error("Missing Yandex Tracker search query.");
				}
				const { query } = parsedArgs.data;
				const result = await mcpTools.callTool(
					"issues_find",
					{
						query,
						include_description: false,
						per_page: 5,
					},
					{ signal },
				);
				return {
					results: [
						{
							title: "Yandex Tracker search",
							content: firstText(result),
						},
					],
				};
			}

			throw new Error(`Unknown Yandex Tracker facade tool: ${name}`);
		},
	};
}
