import { buildVoiceToolRegistry } from "../ai/tools/tool-registry.mjs";
import { log } from "./logger.mjs";
import { pickToolPreamble } from "./realtime-voice-patterns.mjs";
import {
	prepareDirectWebSearchMessages,
	prepareToolAugmentedMessages,
} from "./tool-loop.mjs";
import { selectToolsForTurn } from "./tool-selector.mjs";

export async function planReply({
	config,
	history,
	prompt,
	settings,
	signal,
	toolManager,
	turnId,
	onEvent,
}) {
	const emit = (event) => onEvent?.(event);
	const onToolActivity = (state) => emit({ type: "tool_activity", ...state });

	const registry = buildVoiceToolRegistry({
		settings,
		webTools: toolManager,
	});
	const plan = selectToolsForTurn({
		text: prompt,
		registry,
		webToolsEnabled: settings.webToolsEnabled ?? true,
	});
	log(
		"tool",
		`selection kind=${plan.kind} category=${plan.category} tools=${plan.toolNames?.length ?? (plan.toolName ? 1 : 0)} web_enabled=${toolManager.enabled} user_enabled=${settings.webToolsEnabled ?? true}`,
	);

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

	if (plan.kind !== "direct_web" && plan.kind !== "tool_assisted_llm")
		return undefined;

	const selectedToolManager = registry.toolManagerFor(plan.toolNames);
	if (!selectedToolManager.enabled) return undefined;

	const preamble = pickToolPreamble({
		language: settings.language,
		turnId,
	});
	log("tool", `preamble turn=${turnId} text=${JSON.stringify(preamble)}`);
	emit({ type: "preamble", sentence: preamble });

	if (plan.kind === "direct_web")
		return await prepareDirectWebSearchMessages({
			prompt,
			history,
			signal,
			systemPrompt: settings.systemPrompt,
			toolManager: selectedToolManager,
			onToolActivity,
		});

	return await prepareToolAugmentedMessages({
		llamaUrl: config.llamaUrl,
		prompt,
		history,
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
	});
}
