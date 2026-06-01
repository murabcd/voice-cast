import { log } from "./logger.mjs";
import { pickToolPreamble } from "./realtime-voice-patterns.mjs";
import { prepareToolAugmentedMessages } from "./tool-loop.mjs";
import { shouldUseWebTools } from "./web-intent.mjs";

export async function planReply({
	config,
	prompt,
	settings,
	signal,
	toolManager,
	turnId,
	onPreamble,
	onToolActivity,
}) {
	const webToolsEnabled = settings.webToolsEnabled ?? true;
	const shouldPrepareTools = webToolsEnabled && shouldUseWebTools(prompt);
	log(
		"tool",
		`gate enabled=${toolManager.enabled} user_enabled=${webToolsEnabled} use=${shouldPrepareTools}`,
	);
	if (!shouldPrepareTools) return undefined;
	onPreamble?.(pickToolPreamble({ language: settings.language, turnId }));
	return await prepareToolAugmentedMessages({
		llamaUrl: config.llamaUrl,
		prompt,
		signal,
		systemPrompt: settings.systemPrompt,
		toolManager,
		maxTokens: settings.maxTokens ?? config.llama.maxTokens,
		temperature: settings.temperature ?? config.llama.temperature,
		topP: settings.topP ?? config.llama.topP,
		repeatPenalty: settings.repeatPenalty ?? config.llama.repeatPenalty,
		rounds: config.llama.toolRounds,
		decisionMaxTokens: config.llama.toolDecisionMaxTokens,
		onToolActivity,
	});
}
