import {
	hasAnyPhrase,
	hasAnyPrefix,
	hasAnyToken,
	normalizeIntentText,
	tokenizeIntentText,
} from "../intent-text.mjs";

const systemDebugWords = new Set(["detection", "stt", "tts", "vad", "вад"]);

const systemDebugPhrases = ["barge in", "voice activity", "web detection"];
const systemDebugPrefixes = [
	"барж",
	"детекц",
	"детекшн",
	"распознаван",
	"синтез",
];

const pronunciationWords = new Set(["accent", "pronunciation", "stress"]);
const pronunciationPrefixes = ["акцент", "произн", "ударени"];

const noOpExactTranscripts = new Set([
	"а",
	"ага",
	"м",
	"молчание",
	"мм",
	"ну",
	"ок",
	"okay",
	"silence",
	"thanks",
	"thank you",
	"тишина",
	"угу",
	"ум",
	"фоновый шум",
	"шум",
	"background noise",
	"hmm",
	"noise",
	"uh",
	"um",
	"yeah",
	"yep",
	"yes",
	"you",
]);

const noOpPhrases = ["yeah i think that s", "yeah i think thats"];

const unclearEnglishWords = new Set([
	"could",
	"has",
	"please",
	"question",
	"sorry",
	"sure",
	"understand",
	"would",
]);

const repeatedCharacterFillers = new Set(["а", "м", "мм", "эм", "ээ", "эээ"]);
const unclearTinyQuestionTokens = new Set([
	"где",
	"как",
	"какой",
	"кто",
	"ты",
	"что",
]);
const unsupportedAssistantPlanPhrases = [
	"мы обновим",
	"мы планируем",
	"мы добавим",
	"мы работаем над улучшением",
	"нашу систему",
	"нашей работы",
];
const unsupportedAssistantFeaturePhrases = [
	"новые функции",
	"система поддержки",
];
const unsupportedAssistantFeaturePrefixes = ["пользовател", "улучш", "удоб"];

function normalized(text) {
	return normalizeIntentText(text);
}

function hasOnlyPunctuationOrSpace(text) {
	for (const character of String(text ?? "")) {
		if (character.trim() === "") continue;
		if (![",", ".", "!", "?", "…"].includes(character)) return false;
	}
	return true;
}

function isShortFiller(text) {
	const value = normalized(text);
	if (noOpExactTranscripts.has(value)) return true;
	if (hasAnyPhrase(value, noOpPhrases)) return true;
	if (!value) return true;
	const tokens = tokenizeIntentText(value);
	if (tokens.length !== 1) return false;
	const token = tokens[0];
	if (!repeatedCharacterFillers.has(token)) return false;
	return hasAtMostTwoDistinctCharacters(token);
}

function hasAtMostTwoDistinctCharacters(value) {
	const seen = [];
	for (const character of value) {
		if (seen.includes(character)) continue;
		seen.push(character);
		if (seen.length > 2) return false;
	}
	return true;
}

function isUnsupportedAssistantIdentityClaim(text) {
	const value = normalized(text);
	const tokens = tokenizeIntentText(value);
	return (
		hasAnyPhrase(value, unsupportedAssistantPlanPhrases) &&
		(hasAnyPhrase(value, unsupportedAssistantFeaturePhrases) ||
			hasAnyPrefix(tokens, unsupportedAssistantFeaturePrefixes))
	);
}

function isAssistantClarification(text) {
	return normalized(text).startsWith("не расслышал повтори");
}

function isAssistantToolFailure(text) {
	return normalized(text).startsWith("не удалось надежно проверить");
}

function isMostlyEnglishTranscript(text) {
	const value = String(text ?? "").trim();
	if (value.length < 3 || value.length > 40) return false;
	for (const character of value) {
		const code = character.codePointAt(0);
		const isAscii =
			code !== undefined &&
			((code >= 65 && code <= 90) ||
				(code >= 97 && code <= 122) ||
				[" ", "'", ".", "!", "?", "-"].includes(character));
		if (!isAscii) return false;
	}
	return true;
}

function isTwoTinyRussianTokens(text) {
	const tokens = tokenizeIntentText(text);
	return (
		tokens.length === 2 &&
		!tokens.some((token) => unclearTinyQuestionTokens.has(token)) &&
		tokens.every((token) => token.length > 0 && token.length <= 4) &&
		tokens.every((token) =>
			[...token].every((character) => {
				const code = character.codePointAt(0);
				return (
					code === 1105 || (code !== undefined && code >= 1072 && code <= 1103)
				);
			}),
		)
	);
}

export const turnClassifierPolicy = {
	isSystemDebug(text) {
		const value = normalized(text);
		const tokens = tokenizeIntentText(value);
		return (
			hasAnyToken(tokens, systemDebugWords) ||
			hasAnyPhrase(value, systemDebugPhrases) ||
			hasAnyPrefix(tokens, systemDebugPrefixes)
		);
	},
	isPronunciationFeedback(text) {
		const tokens = tokenizeIntentText(text);
		return (
			hasAnyToken(tokens, pronunciationWords) ||
			hasAnyPrefix(tokens, pronunciationPrefixes)
		);
	},
	isUnsupportedAssistantIdentityClaim,
	isAssistantClarification,
	isAssistantToolFailure,
};

export const realtimeVoicePolicy = {
	isNoOpTranscript(text) {
		return hasOnlyPunctuationOrSpace(text) || isShortFiller(text);
	},
	isUnclearRussianTranscript(text) {
		const value = normalized(text);
		const tokens = tokenizeIntentText(value);
		return (
			isMostlyEnglishTranscript(text) ||
			hasAnyToken(tokens, unclearEnglishWords) ||
			isTwoTinyRussianTokens(text)
		);
	},
	toolPreambles: {
		ru: [
			"Секунду, прове́рю.",
			"Сейчас посмотрю.",
			"Уточню по источникам.",
			"Прове́рю и сразу отвечу.",
		],
		en: [
			"I'll check that.",
			"Let me verify that.",
			"I'll look that up.",
			"I'll check the sources.",
		],
	},
};
