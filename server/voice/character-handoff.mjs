import {
	canHandoffCharacter,
	greetingCharacterName,
	listCharacterPresets,
	resolveCharacterPreset,
	spokenCharacterName,
} from "./character-context.mjs";
import {
	hasAnyToken,
	hasOrderedTerms,
	tokenizeIntentText,
} from "./intent-text.mjs";

const handoffTokens = new Set([
	"change",
	"handoff",
	"switch",
	"transfer",
	"переключи",
	"переключить",
	"передай",
	"передать",
	"перейди",
	"перейти",
	"поменяй",
	"переведи",
	"позови",
	"позвать",
	"зови",
	"сменить",
	"смени",
]);

export function selectCharacterHandoff(text, currentCharacterId) {
	const tokens = tokenizeIntentText(text);
	if (!hasAnyToken(tokens, handoffTokens)) return undefined;
	for (const candidate of listCharacterPresets()) {
		if (!canHandoffCharacter(currentCharacterId, candidate.id)) continue;
		if (!candidate.aliases.some((alias) => hasOrderedTerms(tokens, alias, 2)))
			continue;
		return resolveCharacterPreset(candidate.id);
	}
	return undefined;
}

export function characterHandoffReply({ character, language }) {
	const name = spokenCharacterName(character, language);
	if (language === "en") return `Switching you to ${name}.`;
	return `Переключаю на ${name}.`;
}

export function buildCharacterHandoffPayload({
	assistantConfirmation,
	fromCharacter,
	fromVoiceName,
	language,
	toCharacter,
	userRequest,
}) {
	const fromName = greetingCharacterName(fromCharacter, language);
	const toName = greetingCharacterName(toCharacter, language);
	return {
		from_character_id: fromCharacter?.id,
		from_character_name: fromName,
		from_voice_name: fromVoiceName,
		to_character_id: toCharacter.id,
		to_character_name: toName,
		to_voice_name: toCharacter.voiceName,
		user_request: String(userRequest ?? ""),
		rationale_for_transfer:
			language === "en"
				? `The user explicitly asked to switch to ${toName}.`
				: `Пользователь явно попросил переключить разговор на персонажа ${toName}.`,
		conversation_context:
			language === "en"
				? `${fromName || "The previous character"} accepted the transfer request and introduced the handoff.`
				: `${fromName || "Предыдущий персонаж"} принял запрос на переключение и начал передачу.`,
		open_task:
			language === "en"
				? "Greet the user as the receiving character and continue from their next request."
				: "Поздороваться как принимающий персонаж и продолжить с ближайшего запроса пользователя.",
		assistant_confirmation: String(assistantConfirmation ?? ""),
	};
}
