import {
	digitNames,
	domainPronunciationLexicon,
	letterNames,
	numberHundreds,
	numberOnes,
	numberTeens,
	numberTens,
	spokenDictionary,
	transliterationPairs,
} from "./policy/pronunciation-policy.mjs";
import { russianStressLexicon } from "./russian-stress-lexicon.mjs";

const latinTokenRe = /\b[A-Za-z][A-Za-z0-9.+-]*\b/g;
const percentRe = /(\d+(?:[.,]\d+)?)\s*%/g;
const stressMark = "\u0301";
const cyrillicWordRe =
	/(?<![А-Яа-яЁё])([А-Яа-яЁё](?:[А-Яа-яЁё]|\u0301)*)(?![А-Яа-яЁё])/g;
const domainPronunciationRe = createLexiconMatcher(domainPronunciationLexicon);
const russianAbbreviationExpansions = [
	{
		pattern: /(^|[^А-Яа-яЁё])и\s*т\s*\.?\s*д(\.)?($|[^А-Яа-яЁё])/giu,
		replacement: "и так далее",
	},
	{
		pattern: /(^|[^А-Яа-яЁё])и\s*др(\.)?($|[^А-Яа-яЁё])/giu,
		replacement: "и другое",
	},
];

export function normalizeRussianSpeechText(text) {
	return applyRussianStressLexicon(
		applyRussianAbbreviationExpansions(
			applyDomainPronunciationLexicon(String(text ?? "")),
		),
	)
		.replace(
			percentRe,
			(_match, value) =>
				`${pronounceRussianNumber(value)} ${percentWord(value)}`,
		)
		.replace(latinTokenRe, (token) => pronounceLatinToken(token))
		.replace(/\s+/g, " ")
		.trim();
}

function applyRussianAbbreviationExpansions(text) {
	return russianAbbreviationExpansions.reduce(
		(result, { pattern, replacement }) =>
			result.replace(pattern, (match, prefix, finalDot, suffix) => {
				const ending = suffix || (finalDot && match.endsWith(".") ? "." : "");
				return `${prefix}${replacement}${ending}`;
			}),
		text,
	);
}

function applyDomainPronunciationLexicon(text) {
	if (!domainPronunciationRe) return text;
	return text.replace(domainPronunciationRe, (match) => {
		if (match.includes(stressMark)) return match;
		const stressed = domainPronunciationLexicon.get(match.toLowerCase());
		if (!stressed) return match;
		return matchPhraseCapitalization(match, stressed);
	});
}

function applyRussianStressLexicon(text) {
	return text.replace(cyrillicWordRe, (word) => {
		if (word.includes(stressMark)) return word;
		const stressed = russianStressLexicon.get(word.toLowerCase());
		if (!stressed) return word;
		return matchCapitalization(word, stressed);
	});
}

function createLexiconMatcher(lexicon) {
	const sources = [...lexicon.keys()].sort((a, b) => b.length - a.length);
	if (sources.length === 0) return undefined;
	return new RegExp(
		`(?<![А-Яа-яЁё])(${sources.map(escapeRegExp).join("|")})(?![А-Яа-яЁё])`,
		"giu",
	);
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function percentWord(value) {
	const integerPart = String(value).split(/[,.]/)[0] ?? "";
	const lastTwo = Number(integerPart.slice(-2));
	const last = Number(integerPart.slice(-1));
	if (lastTwo >= 11 && lastTwo <= 14) return "процентов";
	if (last === 1) return "процент";
	if (last >= 2 && last <= 4) return "процента";
	return "процентов";
}

function pronounceRussianNumber(value) {
	const text = String(value);
	const [integerText, fractionText] = text.split(/[,.]/);
	const integer = Number(integerText);
	if (!Number.isInteger(integer) || integer < 0 || integer > 999)
		return text.replace(".", ",");
	const integerWords = pronounceRussianInteger(integer);
	if (!fractionText) return integerWords;
	return `${integerWords} целых ${pronounceDigits(fractionText)}`;
}

function pronounceRussianInteger(value) {
	if (value < 10) return numberOnes[value];
	if (value < 20) return numberTeens[value - 10];
	if (value < 100) {
		const tens = Math.floor(value / 10) * 10;
		const ones = value % 10;
		return [numberTens[tens], ones ? numberOnes[ones] : ""]
			.filter(Boolean)
			.join(" ");
	}
	const hundreds = Math.floor(value / 100) * 100;
	const rest = value % 100;
	return [numberHundreds[hundreds], rest ? pronounceRussianInteger(rest) : ""]
		.filter(Boolean)
		.join(" ");
}

function pronounceLatinToken(token) {
	const key = token.toLowerCase();
	if (spokenDictionary.has(key)) return spokenDictionary.get(key);
	const parts = token.match(/[A-Za-z]\d+|[A-Za-z]+|\d+|[.+-]/g) ?? [token];
	return parts
		.map((part) => {
			if (/^\d+$/.test(part)) return pronounceDigits(part);
			if (/^[A-Z]{2,}$/.test(part)) return pronounceLetters(part);
			if (/^[A-Za-z]\d+$/.test(part)) {
				return `${pronounceLetters(part[0])} ${pronounceDigits(part.slice(1))}`;
			}
			if (/^[A-Za-z]+$/.test(part)) return transliterateLatinWord(part);
			if (part === "+") return "плюс";
			if (part === ".") return "точка";
			if (part === "-") return "дэш";
			return part;
		})
		.join(" ");
}

function pronounceDigits(value) {
	return [...value].map((digit) => digitNames[digit] ?? digit).join(" ");
}

function pronounceLetters(value) {
	return [...value.toLowerCase()]
		.map((letter) => letterNames[letter] ?? letter)
		.join("-");
}

function transliterateLatinWord(value) {
	let rest = value.toLowerCase();
	let out = "";
	while (rest) {
		const pair = transliterationPairs.find(([latin]) => rest.startsWith(latin));
		if (!pair) {
			out += rest[0];
			rest = rest.slice(1);
			continue;
		}
		out += pair[1];
		rest = rest.slice(pair[0].length);
	}
	return matchCapitalization(value, out);
}

function matchCapitalization(source, value) {
	if (/^[A-ZА-ЯЁ]+$/.test(source)) return value.toUpperCase();
	if (/^[A-ZА-ЯЁ]/.test(source))
		return `${value[0].toUpperCase()}${value.slice(1)}`;
	return value;
}

function matchPhraseCapitalization(source, value) {
	const sourceWords = source.split(/\s+/);
	const valueWords = value.split(/\s+/);
	if (sourceWords.length !== valueWords.length)
		return matchCapitalization(source, value);
	return valueWords
		.map((word, index) => matchCapitalization(sourceWords[index] ?? "", word))
		.join(" ");
}
