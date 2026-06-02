import {
	hasAnyPhrase,
	hasAnyPrefix,
	hasAnyToken,
	normalizeIntentText,
	tokenizeIntentText,
} from "../intent-text.mjs";

const londonWords = new Set(["лондон", "london"]);
const tokyoWords = new Set(["токио", "tokyo"]);
const todayWords = new Set(["сегодня"]);

export const cityTimeZones = [
	{
		timeZone: "Europe/Moscow",
		match: (text) =>
			hasAnyPrefix(tokenizeIntentText(text), ["москв"]) ||
			hasAnyPhrase(normalizeIntentText(text), ["moscow"]),
		names: { ru: "Москве", en: "Moscow" },
	},
	{
		timeZone: "America/New_York",
		match: (text) =>
			hasAnyPhrase(normalizeIntentText(text), ["нью йорк", "new york"]),
		names: { ru: "Нью-Йорке", en: "New York" },
	},
	{
		timeZone: "Europe/London",
		match: (text) => hasAnyToken(tokenizeIntentText(text), londonWords),
		names: { ru: "Лондоне", en: "London" },
	},
	{
		timeZone: "Asia/Tokyo",
		match: (text) => hasAnyToken(tokenizeIntentText(text), tokyoWords),
		names: { ru: "Токио", en: "Tokyo" },
	},
];

const timeWords = new Set(["time", "час"]);
const timePrefixes = ["врем"];
const dateWords = new Set(["date"]);
const datePrefixes = ["дат"];
const weekdayWords = new Set(["weekday"]);
const weekdayPhrases = ["day of week", "день недели"];

function isTimeRequest(text) {
	const normalized = normalizeIntentText(text);
	const tokens = tokenizeIntentText(text);
	return (
		hasAnyPhrase(normalized, ["current time", "what time", "время на часах"]) ||
		hasAnyToken(tokens, timeWords) ||
		hasAnyPrefix(tokens, timePrefixes)
	);
}

function isWeekdayRequest(text) {
	const normalized = normalizeIntentText(text);
	const tokens = tokenizeIntentText(text);
	return (
		hasAnyPhrase(normalized, weekdayPhrases) ||
		hasAnyToken(tokens, weekdayWords) ||
		(hasAnyToken(tokens, todayWords) && hasAnyPrefix(tokens, ["день"]))
	);
}

function isDateRequest(text) {
	const normalized = normalizeIntentText(text);
	const tokens = tokenizeIntentText(text);
	return (
		hasAnyPhrase(normalized, ["current date", "today date", "todays date"]) ||
		hasAnyToken(tokens, dateWords) ||
		hasAnyPrefix(tokens, datePrefixes) ||
		(hasAnyToken(tokens, todayWords) && hasAnyPrefix(tokens, ["день"]))
	);
}

export const localDateTimeRoutes = [
	{
		toolName: "current_time",
		description:
			"Return the current local time for the user's configured time zone or a city mentioned in the request.",
		parameters: {
			type: "object",
			properties: {
				location_text: {
					type: "string",
					description: "The original user text containing an optional city.",
				},
			},
			required: ["location_text"],
			additionalProperties: false,
		},
		match: isTimeRequest,
	},
	{
		toolName: "weekday",
		description:
			"Return the current weekday for the user's configured time zone or a city mentioned in the request.",
		parameters: {
			type: "object",
			properties: {
				location_text: {
					type: "string",
					description: "The original user text containing an optional city.",
				},
			},
			required: ["location_text"],
			additionalProperties: false,
		},
		match: isWeekdayRequest,
	},
	{
		toolName: "current_date",
		description:
			"Return today's date for the user's configured time zone or a city mentioned in the request.",
		parameters: {
			type: "object",
			properties: {
				location_text: {
					type: "string",
					description: "The original user text containing an optional city.",
				},
			},
			required: ["location_text"],
			additionalProperties: false,
		},
		match: isDateRequest,
	},
];

export const russianWeekdays = [
	"воскресенье",
	"понедельник",
	"вторник",
	"среда",
	"четверг",
	"пятница",
	"суббота",
];
