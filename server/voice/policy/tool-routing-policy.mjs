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

export function isDirectWebRequest(text) {
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

export function isExternalTopicRequest(text) {
	const { normalized, tokens } = textParts(text);
	return (
		hasAnyToken(tokens, externalTopicWords) ||
		hasAnyPhrase(normalized, externalTopicPhrases) ||
		hasAnyPrefix(tokens, externalTopicPrefixes) ||
		hasAnyToken(tokens, externalTopicExactWords)
	);
}

export function isLocalConversationRequest(text) {
	const { normalized, tokens } = textParts(text);
	return (
		greetingWords.has(tokens[0]) ||
		hasAnyPhrase(normalized, localConversationPhrases)
	);
}

export function hasNamedEntity(text) {
	return hasCapitalizedAsciiToken(text);
}

export function isQuestion(text) {
	return hasAnyToken(tokenizeIntentText(text), questionWords);
}

export function isLocalFollowUp(text) {
	return hasAnyPhrase(normalizeIntentText(text), localFollowUpPhrases);
}

export function isMutableFactFollowUp(text) {
	const tokens = tokenizeIntentText(text);
	return (
		hasAnyToken(tokens, mutableFactWords) ||
		hasAnyToken(tokens, mutableFactExactWords) ||
		hasAnyPrefix(tokens, mutableFactPrefixes)
	);
}

export function isReferenceFollowUp(text) {
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
