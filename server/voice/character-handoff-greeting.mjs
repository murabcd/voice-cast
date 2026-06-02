import { runtimeCharacterContext } from "./character-context.mjs";
import { startLlmGreetingTurn } from "./llm-greeting-turn.mjs";
import { runtimeSessionContext } from "./session-context.mjs";
import { createTurnLog } from "./turn-logging.mjs";

export function characterHandoffGreetingPrompt({ handoff, language }) {
	if (language === "en")
		return [
			"You are now the active character after a handoff.",
			`Previous character: ${handoff?.from_character_name || "unknown"}.`,
			`New character: ${handoff?.to_character_name}.`,
			`User handoff request: ${handoff?.user_request}.`,
			`Rationale for transfer: ${handoff?.rationale_for_transfer}.`,
			`Conversation context: ${handoff?.conversation_context}.`,
			`Open task: ${handoff?.open_task}.`,
			"Greet the user as the new character in one short sentence.",
			"Make it clear you are now listening, without explaining system internals.",
		].join("\n");
	return [
		"Ты теперь активный персонаж после переключения.",
		`Предыдущий персонаж: ${handoff?.from_character_name || "неизвестно"}.`,
		`Новый персонаж: ${handoff?.to_character_name}.`,
		`Запрос пользователя на переключение: ${handoff?.user_request}.`,
		`Причина передачи: ${handoff?.rationale_for_transfer}.`,
		`Контекст разговора: ${handoff?.conversation_context}.`,
		`Открытая задача: ${handoff?.open_task}.`,
		"Поздоровайся как новый персонаж одним коротким предложением.",
		"Дай понять, что ты на связи и слушаешь, но не объясняй внутреннюю механику.",
	].join("\n");
}

export function characterHandoffRuntimeContext({ handoff, language }) {
	if (language === "en")
		return [
			"## Handoff Context",
			`The previous character transferred the user to ${handoff?.to_character_name}.`,
			handoff?.from_character_name
				? `Previous character: ${handoff.from_character_name}.`
				: "",
			handoff?.user_request ? `User request: ${handoff.user_request}.` : "",
			handoff?.rationale_for_transfer
				? `Rationale: ${handoff.rationale_for_transfer}.`
				: "",
			handoff?.conversation_context
				? `Conversation context: ${handoff.conversation_context}.`
				: "",
			handoff?.open_task ? `Open task: ${handoff.open_task}.` : "",
			"Use this context only to acknowledge the handoff naturally.",
		]
			.filter(Boolean)
			.join("\n");
	return [
		"## Контекст переключения",
		`Предыдущий персонаж передал пользователя персонажу ${handoff?.to_character_name}.`,
		handoff?.from_character_name
			? `Предыдущий персонаж: ${handoff.from_character_name}.`
			: "",
		handoff?.user_request
			? `Запрос пользователя: ${handoff.user_request}.`
			: "",
		handoff?.rationale_for_transfer
			? `Причина: ${handoff.rationale_for_transfer}.`
			: "",
		handoff?.conversation_context
			? `Контекст разговора: ${handoff.conversation_context}.`
			: "",
		handoff?.open_task ? `Открытая задача: ${handoff.open_task}.` : "",
		"Используй этот контекст только для естественного принятия переключения.",
	]
		.filter(Boolean)
		.join("\n");
}

export async function startCharacterHandoffGreeting({
	config,
	handoff,
	handoffSettings,
	history,
	log,
	logError,
	sendJson,
	speakSentence,
	turnRuntime,
	ws,
}) {
	const startedAt = Date.now();
	turnRuntime.beginNextTurn();
	const greetingRuntimeContext = [
		runtimeSessionContext({ language: handoffSettings.language }),
		runtimeCharacterContext({
			characterId: handoffSettings.characterId,
			language: handoffSettings.language,
		}),
		characterHandoffRuntimeContext({
			handoff,
			language: handoffSettings.language,
		}),
	]
		.filter(Boolean)
		.join("\n\n");
	const handoffContext = history.handoffContext();
	const promptHistory = handoffContext
		? [handoffContext, ...history.messages()]
		: history.messages();
	await startLlmGreetingTurn({
		config,
		startedAt,
		transcript: "[character handoff greeting]",
		createLogEvent: (newTurn) => ({
			...createTurnLog({
				turnId: newTurn.id,
				startedAt,
				transcript: "[character handoff greeting]",
				settings: handoffSettings,
				config,
			}),
			turn_source: "character_handoff_greeting",
		}),
		history: promptHistory,
		log,
		logError,
		maxTokens: Math.min(
			handoffSettings.maxTokens ?? config.llama.maxTokens,
			80,
		),
		prompt: characterHandoffGreetingPrompt({
			handoff,
			language: handoffSettings.language,
		}),
		purpose: "character_handoff_greeting",
		repeatPenalty: handoffSettings.repeatPenalty ?? config.llama.repeatPenalty,
		runtimeContext: greetingRuntimeContext,
		sendJson,
		settings: handoffSettings,
		speakSentence,
		temperature: handoffSettings.temperature ?? config.llama.temperature,
		topP: handoffSettings.topP ?? config.llama.topP,
		turnRuntime,
		ws,
	});
}
