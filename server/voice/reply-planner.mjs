import { buildVoiceToolRegistry } from "../ai/tools/tool-registry.mjs";
import { log } from "./logger.mjs";
import { pickToolPreamble } from "./realtime-voice-patterns.mjs";
import {
	prepareDirectToolResultMessages,
	prepareDirectWebFetchMessages,
	prepareDirectWebSearchMessages,
	prepareToolAugmentedMessages,
} from "./tool-loop.mjs";
import { selectToolsForTurn } from "./tool-selector.mjs";

export async function planReply({
	config,
	history,
	historyContext,
	registry: providedRegistry,
	prompt,
	runtimeContext,
	settings,
	signal,
	toolManager,
	mcpTools,
	turnId,
	onEvent,
}) {
	const emit = (event) => onEvent?.(event);
	const onToolActivity = (state) => emit({ type: "tool_activity", ...state });
	const onToolResult = (event) => emit(event);

	const registry =
		providedRegistry ??
		buildVoiceToolRegistry({
			settings,
			webTools: toolManager,
			mcpTools,
			trackerDefaultQueue: config.mcp?.trackerDefaultQueue,
			trackerLimitQueues: config.mcp?.trackerLimitQueues,
		});
	const plan = selectToolsForTurn({
		text: prompt,
		registry,
		webContext: historyContext?.web,
		webToolsEnabled: settings.webToolsEnabled ?? true,
	});
	const toolNames = plan.toolNames ?? (plan.toolName ? [plan.toolName] : []);
	log(
		"tool",
		`selection kind=${plan.kind} category=${plan.category} tools=${toolNames.length} web_enabled=${toolManager.enabled} mcp_enabled=${mcpTools?.enabled === true} user_enabled=${settings.webToolsEnabled ?? true}`,
	);
	emit({
		type: "tool_route",
		kind: plan.kind,
		category: plan.category,
		toolNames,
		...(plan.kind === "direct_web_fetch" ? { arguments: plan.arguments } : {}),
		...(plan.kind === "direct_web" && plan.query ? { query: plan.query } : {}),
		queryChars: plan.query ? plan.query.length : 0,
		webFollowUp: plan.category.startsWith("web_followup_"),
	});

	if (plan.kind === "direct_tool") {
		onToolActivity({ active: true, name: plan.toolName });
		try {
			const result = await registry.callTool(plan.toolName, plan.arguments, {
				signal,
			});
			return {
				kind: "direct_reply",
				toolName: plan.toolName,
				reply: result.reply,
				result: result.result,
			};
		} finally {
			onToolActivity({ active: false, name: plan.toolName });
		}
	}

	if (
		plan.kind !== "direct_web" &&
		plan.kind !== "direct_web_fetch" &&
		plan.kind !== "direct_tool_result" &&
		plan.kind !== "tool_assisted_llm"
	)
		return undefined;

	const selectedToolManager = registry.toolManagerFor(
		plan.toolNames ?? [plan.toolName],
	);
	if (!selectedToolManager.enabled)
		throw new Error("Selected tools are not available.");

	const preamble = pickToolPreamble({
		language: settings.language,
		turnId,
	});
	log("tool", `preamble turn=${turnId} text=${JSON.stringify(preamble)}`);
	emit({ type: "preamble", sentence: preamble });

	if (plan.kind === "direct_web")
		return await prepareDirectWebSearchMessages({
			prompt,
			searchQuery: plan.query,
			history,
			runtimeContext,
			signal,
			systemPrompt: settings.systemPrompt,
			toolManager: selectedToolManager,
			onToolActivity,
			onToolResult,
		});

	if (plan.kind === "direct_web_fetch")
		return await prepareDirectWebFetchMessages({
			prompt,
			history,
			runtimeContext,
			signal,
			systemPrompt: settings.systemPrompt,
			toolManager: selectedToolManager,
			toolArguments: plan.arguments,
			onToolActivity,
			onToolResult,
		});

	if (plan.kind === "direct_tool_result")
		return await prepareDirectToolResultMessages({
			prompt,
			history,
			runtimeContext,
			signal,
			systemPrompt: settings.systemPrompt,
			toolManager: selectedToolManager,
			toolName: plan.toolName,
			toolArguments: plan.arguments,
			onToolActivity,
			onToolResult,
		});

	return await prepareToolAugmentedMessages({
		llamaUrl: config.llamaUrl,
		prompt,
		history,
		runtimeContext,
		signal,
		systemPrompt: settings.systemPrompt,
		toolManager: selectedToolManager,
		maxTokens: settings.maxTokens ?? config.llama.maxTokens,
		temperature: settings.temperature ?? config.llama.temperature,
		topP: settings.topP ?? config.llama.topP,
		repeatPenalty: settings.repeatPenalty ?? config.llama.repeatPenalty,
		rounds: config.llama.toolRounds,
		decisionMaxTokens: config.llama.toolDecisionMaxTokens,
		onToolActivity,
		onToolResult,
	});
}
