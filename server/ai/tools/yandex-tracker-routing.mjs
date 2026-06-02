import {
	hasAnyPrefix,
	hasAnyToken,
	tokenizeIntentText,
} from "../../voice/intent-text.mjs";
import { parseRussianSpokenNumberPrefix } from "./russian-spoken-number.mjs";

const trackerSignalWords = new Set([
	"issue",
	"queue",
	"ticket",
	"tracker",
	"yandex",
	"задача",
	"задаче",
	"задачи",
	"задачу",
	"тикет",
	"трекер",
	"яндекс",
]);
const trackerSignalPrefixes = ["очеред"];
const searchWords = new Set([
	"assignee",
	"find",
	"list",
	"search",
	"автор",
	"все",
	"всё",
	"исполнител",
	"количеств",
	"найди",
	"найти",
	"поищи",
	"поиск",
	"покажи",
	"приоритет",
	"сколько",
	"список",
	"статус",
]);
const searchPrefixes = ["очеред", "пользовател"];
const issueAnchorTerms = [
	"номером",
	"номер",
	"задача",
	"задаче",
	"задачи",
	"задачу",
	"тикет",
	"issue",
	"ticket",
];
const issueNumberLookahead = 8;
const issueNumberSkipWords = new Set([
	"с",
	"со",
	"по",
	"под",
	"про",
	"информацию",
	"контекст",
]);

function hasTool(availableToolNames, name) {
	return availableToolNames.has(name);
}

function addIfAvailable(selected, availableToolNames, names) {
	for (const name of names) {
		if (hasTool(availableToolNames, name) && !selected.includes(name)) {
			selected.push(name);
		}
	}
}

function normalizeQueue(value) {
	const queue = String(value ?? "")
		.trim()
		.toUpperCase();
	if (queue.length < 2 || queue.length > 21) return "";
	const first = queue[0];
	if (first < "A" || first > "Z") return "";
	for (const character of queue) {
		const isLetter = character >= "A" && character <= "Z";
		const isDigitValue = isDigit(character);
		if (!isLetter && !isDigitValue) return "";
	}
	return queue;
}

function normalizeIssueNumber(value) {
	let number = "";
	for (const character of String(value ?? "")) {
		if (isDigit(character)) number += character;
	}
	return number.length >= 1 && number.length <= 8 ? number : "";
}

function isLatinLetter(char) {
	const lower = char.toLowerCase();
	return lower >= "a" && lower <= "z";
}

function isRussianLetter(char) {
	const lower = char.toLowerCase();
	return lower === "ё" || (lower >= "а" && lower <= "я");
}

function isDigit(char) {
	return char >= "0" && char <= "9";
}

function trackerTokens(text) {
	const tokens = [];
	let current = "";
	for (const char of String(text ?? "")) {
		if (isLatinLetter(char) || isRussianLetter(char) || isDigit(char)) {
			current += char;
			continue;
		}
		if (current) {
			tokens.push(current);
			current = "";
		}
	}
	if (current) tokens.push(current);
	return tokens;
}

function tokenNumber(tokens, index) {
	const token = tokens[index] ?? "";
	const numeric = normalizeIssueNumber(token);
	if (numeric) {
		let combined = numeric;
		for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
			const next = normalizeIssueNumber(tokens[cursor]);
			if (!next) break;
			combined += next;
			if (combined.length >= 8) break;
		}
		return normalizeIssueNumber(combined) || numeric;
	}
	return normalizeIssueNumber(
		parseRussianSpokenNumberPrefix(tokens.slice(index)),
	);
}

function numberAfterToken(tokens, index) {
	const limit = Math.min(tokens.length, index + 1 + issueNumberLookahead);
	for (let cursor = index + 1; cursor < limit; cursor += 1) {
		const token = String(tokens[cursor] ?? "").toLowerCase();
		if (issueNumberSkipWords.has(token)) continue;
		const number = tokenNumber(tokens, cursor);
		if (number) return number;
	}
	return "";
}

function issueNumberFromTokens(prompt, options = {}) {
	const tokens = trackerTokens(prompt);
	const knownQueues = normalizeKnownQueues(options);

	for (let index = 0; index < tokens.length; index += 1) {
		const token = String(tokens[index] ?? "");
		const queue = normalizeQueue(token);
		if (!queue || !knownQueues.has(queue)) continue;
		const nextNumber = numberAfterToken(tokens, index);
		if (nextNumber) return { queue, number: nextNumber };
	}

	const queue = normalizeQueue(options.defaultQueue);
	if (!queue) return undefined;
	for (let index = 0; index < tokens.length; index += 1) {
		const token = String(tokens[index] ?? "").toLowerCase();
		if (!issueAnchorTerms.includes(token)) continue;
		const number = numberAfterToken(tokens, index);
		if (number) return { queue, number };
	}
	return undefined;
}

function normalizeKnownQueues({ defaultQueue, limitQueues } = {}) {
	return new Set(
		[defaultQueue, ...String(limitQueues ?? "").split(",")]
			.map((queue) => normalizeQueue(queue))
			.filter(Boolean),
	);
}

function hasTrackerSignal(prompt) {
	const tokens = tokenizeIntentText(prompt);
	return (
		hasAnyToken(tokens, trackerSignalWords) ||
		hasAnyPrefix(tokens, trackerSignalPrefixes)
	);
}

function hasSearchSignal(prompt) {
	const tokens = tokenizeIntentText(prompt);
	return (
		hasAnyToken(tokens, searchWords) || hasAnyPrefix(tokens, searchPrefixes)
	);
}

function extractDirectIssueKey(text) {
	const value = String(text ?? "");
	for (let index = 0; index < value.length; index += 1) {
		let queue = "";
		let cursor = index;
		while (cursor < value.length) {
			const character = value[cursor].toUpperCase();
			if (
				(character >= "A" && character <= "Z") ||
				(queue && isDigit(character))
			) {
				queue += character;
				cursor += 1;
				continue;
			}
			break;
		}
		if (!normalizeQueue(queue)) continue;
		while (value[cursor] === " ") cursor += 1;
		if (value[cursor] !== "-") continue;
		cursor += 1;
		while (value[cursor] === " ") cursor += 1;
		let number = "";
		while (cursor < value.length && isDigit(value[cursor])) {
			number += value[cursor];
			cursor += 1;
		}
		number = normalizeIssueNumber(number);
		if (number) return `${queue}-${number}`;
	}
	return undefined;
}

function extractYandexTrackerIssueKey(text, options = {}) {
	const prompt = String(text ?? "");
	const direct = extractDirectIssueKey(prompt);
	if (direct) return direct;

	const tokenMatch = issueNumberFromTokens(prompt, options);
	return tokenMatch ? `${tokenMatch.queue}-${tokenMatch.number}` : undefined;
}

export function selectYandexTrackerTools(text, tools, options = {}) {
	const prompt = String(text ?? "");
	if (!hasTrackerSignal(prompt)) return undefined;

	const availableToolNames = new Set((tools ?? []).map((tool) => tool.name));
	const issueKey = extractYandexTrackerIssueKey(prompt, options);

	if (issueKey && hasTool(availableToolNames, "yandex_tracker_get_issue")) {
		return {
			mode: "direct",
			category: "mcp_yandex_tracker_issue",
			toolName: "yandex_tracker_get_issue",
			arguments: { issueKey },
		};
	}

	const selected = [];
	if (hasSearchSignal(prompt) || hasTrackerSignal(prompt))
		addIfAvailable(selected, availableToolNames, ["yandex_tracker_search"]);
	if (!selected.length) return undefined;

	return {
		mode: "assisted",
		category: "mcp_yandex_tracker",
		toolNames: selected.slice(0, 3),
	};
}
