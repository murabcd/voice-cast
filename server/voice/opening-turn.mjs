import { runtimeCharacterContext } from "./character-context.mjs";
import { startLlmGreetingTurn } from "./llm-greeting-turn.mjs";
import { runtimeSessionContext } from "./session-context.mjs";
import { createTurnLog } from "./turn-logging.mjs";

export function openingTurnPrompt({ language }) {
	if (language === "en")
		return [
			"The user has just started a voice conversation.",
			"Greet them as the active character in one short sentence.",
			"Invite them to say what they want to do next.",
			"Do not describe tools, capabilities, settings, or system behavior.",
			"Do not claim you already know the user's task.",
		].join("\n");
	return [
		"Пользователь только что начал голосовой разговор.",
		"Поздоровайся как активный персонаж одним коротким предложением.",
		"Предложи пользователю сказать, что он хочет сделать дальше.",
		"Не описывай инструменты, возможности, настройки или системное поведение.",
		"Не утверждай, что уже знаешь задачу пользователя.",
	].join("\n");
}

export function openingTurnRuntimeContext({ language }) {
	if (language === "en")
		return [
			"## Opening Turn",
			"This is a constrained first greeting.",
			"There is no user task yet.",
			"Use this context only to greet the user briefly.",
		].join("\n");
	return [
		"## Первый ход",
		"Это ограниченное первое приветствие.",
		"Пользователь еще не дал задачу.",
		"Используй этот контекст только для короткого приветствия.",
	].join("\n");
}

export async function startOpeningTurn({
	config,
	log,
	logError,
	sendJson,
	settings,
	speakSentence,
	turnRuntime,
	ws,
}) {
	const startedAt = Date.now();
	if (turnRuntime.hasActive()) turnRuntime.cancel("opening turn");
	turnRuntime.beginNextTurn();
	const runtimeContext = [
		runtimeSessionContext({ language: settings.language }),
		runtimeCharacterContext({
			characterId: settings.characterId,
			language: settings.language,
		}),
		openingTurnRuntimeContext({ language: settings.language }),
	]
		.filter(Boolean)
		.join("\n\n");
	await startLlmGreetingTurn({
		config,
		startedAt,
		transcript: "[server opening]",
		createLogEvent: (newTurn) => ({
			...createTurnLog({
				turnId: newTurn.id,
				startedAt,
				transcript: "[server opening]",
				settings,
				config,
			}),
			turn_source: "server_opening",
		}),
		history: [],
		log,
		logError,
		maxTokens: Math.min(settings.maxTokens ?? config.llama.maxTokens, 60),
		prompt: openingTurnPrompt({ language: settings.language }),
		purpose: "server_opening",
		repeatPenalty: settings.repeatPenalty ?? config.llama.repeatPenalty,
		runtimeContext,
		sendJson,
		settings,
		speakSentence,
		temperature: settings.temperature ?? config.llama.temperature,
		topP: settings.topP ?? config.llama.topP,
		turnRuntime,
		ws,
	});
}
