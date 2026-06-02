import {
	hasAnyPhrase,
	hasAnyPrefix,
	hasAnyToken,
	hasCapitalizedAsciiToken,
	hasOrderedTerms,
	hasUppercaseLetterSequence,
	normalizeIntentText,
	tokenizeIntentText,
} from "../intent-text.mjs";
import { correctSpokenDomainLabel } from "./domain-correction-policy.mjs";
import {
	directWeatherPrefixes,
	directWeatherWords,
	directWebPhrases,
	domainSuffixes,
	externalTopicExactWords,
	externalTopicPhrases,
	externalTopicPrefixes,
	externalTopicWords,
	greetingWords,
	localConversationPhrases,
	localFollowUpPhrases,
	mutableFactExactWords,
	mutableFactPrefixes,
	mutableFactWords,
	questionWords,
	referenceFollowUpPhrases,
	spelledLetterPhrases,
	webActionWords,
	webContextWords,
} from "./tool-routing-lexicon.mjs";

function textParts(text) {
	const tokens = tokenizeIntentText(text);
	return { normalized: tokens.join(" "), tokens };
}

function hasDomainLikeToken(tokens) {
	return tokens.some((token, index) => {
		if (!domainSuffixes.has(tokens[index + 1])) return false;
		return token.length >= 2;
	});
}

function isAsciiDomainLabel(token) {
	if (token.length < 2 || token.length > 63) return false;
	for (const character of token) {
		const isLowerAscii = character >= "a" && character <= "z";
		const isDigit = character >= "0" && character <= "9";
		if (!isLowerAscii && !isDigit) return false;
	}
	return true;
}

function explicitWebUrl(text) {
	const tokens = tokenizeIntentText(text);
	for (let index = 0; index < tokens.length - 1; index += 1) {
		if (!domainSuffixes.has(tokens[index + 1])) continue;
		if (!isAsciiDomainLabel(tokens[index])) continue;
		const labels = [correctSpokenDomainLabel(tokens[index]), tokens[index + 1]];
		for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
			const token = tokens[cursor];
			if (!isAsciiDomainLabel(token)) break;
			labels.unshift(correctSpokenDomainLabel(token));
		}
		return `https://${labels.join(".")}`;
	}
	return undefined;
}

function hasCompanyLookup(tokens) {
	return hasOrderedTerms(
		tokens,
		[
			(token) => token === "посмотри" || token === "проверь",
			(token) => token.startsWith("компани"),
		],
		8,
	);
}

function isDirectWebRequest(text) {
	const { normalized, tokens } = textParts(text);
	return (
		hasAnyPhrase(normalized, directWebPhrases) ||
		hasDomainLikeToken(tokens) ||
		(hasAnyToken(tokens, webActionWords) &&
			hasAnyToken(tokens, webContextWords)) ||
		hasCompanyLookup(tokens) ||
		hasAnyPrefix(tokens, directWeatherPrefixes) ||
		hasAnyToken(tokens, directWeatherWords) ||
		(hasAnyPhrase(normalized, spelledLetterPhrases) &&
			hasUppercaseLetterSequence(text))
	);
}

function isExternalTopicRequest(text) {
	const { normalized, tokens } = textParts(text);
	return (
		hasAnyToken(tokens, externalTopicWords) ||
		hasAnyPhrase(normalized, externalTopicPhrases) ||
		hasAnyPrefix(tokens, externalTopicPrefixes) ||
		hasAnyToken(tokens, externalTopicExactWords)
	);
}

function isLocalConversationRequest(text) {
	const { normalized, tokens } = textParts(text);
	return (
		greetingWords.has(tokens[0]) ||
		hasAnyPhrase(normalized, localConversationPhrases)
	);
}

function hasNamedEntity(text) {
	return hasCapitalizedAsciiToken(text);
}

function isQuestion(text) {
	return hasAnyToken(tokenizeIntentText(text), questionWords);
}

function isLocalFollowUp(text) {
	return hasAnyPhrase(normalizeIntentText(text), localFollowUpPhrases);
}

function isMutableFactFollowUp(text) {
	const tokens = tokenizeIntentText(text);
	return (
		hasAnyToken(tokens, mutableFactWords) ||
		hasAnyToken(tokens, mutableFactExactWords) ||
		hasAnyPrefix(tokens, mutableFactPrefixes)
	);
}

function isReferenceFollowUp(text) {
	const normalized = normalizeIntentText(text);
	return hasAnyPhrase(normalized, referenceFollowUpPhrases);
}

export const webRoutingPolicy = {
	routes: [
		{
			mode: "direct",
			category: "fresh_external",
			toolNames: ["web_search"],
			match: isDirectWebRequest,
		},
		{
			mode: "assisted",
			category: "external_topic",
			toolNames: ["web_search", "web_fetch"],
			match: isExternalTopicRequest,
		},
	],
	isLocalConversationRequest,
	hasNamedEntity,
	isQuestion,
	isLocalFollowUp,
	explicitWebUrl,
	followUpRoutes: [
		{
			category: "web_followup_mutable_fact",
			toolNames: ["web_search"],
			match: isMutableFactFollowUp,
		},
		{
			category: "web_followup_reference",
			toolNames: ["web_search"],
			match: isReferenceFollowUp,
		},
	],
};
