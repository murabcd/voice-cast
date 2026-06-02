import { z } from "zod";
import type { ToolActivityProvider, ToolResultSummary } from "./app-types";

const toolActivityProviderSchema = z.union([
	z.literal("web"),
	z.literal("yandex-tracker"),
]);

const toolActivityMessageSchema = z
	.object({
		active: z.boolean(),
		name: z.string().optional(),
		provider: toolActivityProviderSchema.optional(),
	})
	.passthrough();

const toolResultSourceSchema = z
	.object({
		title: z.string().trim().min(1),
		url: z.string().trim().min(1).optional(),
	})
	.strict();

const toolResultItemSchema = z
	.object({
		content: z.string().trim(),
		title: z.string().trim().min(1),
		url: z.string().trim().min(1).optional(),
	})
	.strict();

const toolResultSectionSchema = z
	.object({
		label: z.string().trim().min(1),
		text: z.string().trim().min(1),
	})
	.strict();

const toolResultSummarySchema = z
	.object({
		id: z.string().trim().min(1),
		provider: toolActivityProviderSchema,
		query: z.string().trim().min(1).optional(),
		results: z.array(toolResultItemSchema),
		sections: z.array(toolResultSectionSchema),
		sources: z.array(toolResultSourceSchema),
		summary: z.string(),
		title: z.string().trim().min(1),
		tools: z.array(z.string().trim().min(1)),
		type: z.literal("tool_result"),
	})
	.strict();

export function parseToolActivityProvider(
	value: unknown,
): ToolActivityProvider | null {
	const parsed = toolActivityMessageSchema.safeParse(value);
	if (!parsed.success || !parsed.data.active) return null;
	if (parsed.data.provider) return parsed.data.provider;
	if (parsed.data.name?.startsWith("web_")) return "web";
	if (parsed.data.name?.startsWith("yandex_tracker_")) return "yandex-tracker";
	return null;
}

export function parseToolResultSummary(
	value: unknown,
): ToolResultSummary | null {
	const parsed = toolResultSummarySchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function shouldAutoOpenToolResult() {
	return window.matchMedia("(min-width: 900px)").matches;
}
