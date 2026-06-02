import { parseRussianSpokenNumberPrefix } from "./russian-spoken-number.mjs";

const trackerSignalPattern =
	/(tracker|yandex|яндекс|трекер|задач[аиу]?|тикет|issue|queue|очеред[ьи])/i;
const issueKeyPattern = /\b[A-Z][A-Z0-9]+-\d+\b/i;
const spacedIssueKeyPattern =
	/\b([A-Z][A-Z0-9]{1,20})\s+(?:номер\s*)?((?:\d[\s.:-]*){1,16})\b/i;
const bareIssueNumberPattern =
	/(?:номер(?:ом)?|задач[аиу]?|тикет|issue|ticket)\D{0,24}((?:\d[\s.:-]*){1,16})\b/i;
const searchPattern =
	/(find|search|list|найди|найти|поищи|поиск|покажи|список|все|всё|очеред[ьи]|статус|приоритет|пользовател|исполнител|assignee|автор|сколько|количеств)/i;
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
	return /^[A-Z][A-Z0-9]{1,20}$/.test(queue) ? queue : "";
}

function normalizeIssueNumber(value) {
	const number = String(value ?? "").replaceAll(/\D+/g, "");
	return /^\d{1,8}$/.test(number) ? number : "";
}

function normalizeIssueNumberText(value) {
	const numeric = normalizeIssueNumber(value);
	if (numeric) return numeric;
	const spoken = parseRussianSpokenNumberPrefix(
		String(value ?? "")
			.toLowerCase()
			.split(" "),
	);
	return normalizeIssueNumber(spoken);
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
	if (numeric) return numeric;
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

function resolveIssueQueue(value, { defaultQueue, knownQueues }) {
	const queue = normalizeQueue(value);
	if (queue && knownQueues.has(queue)) return queue;
	return normalizeQueue(defaultQueue);
}

function extractYandexTrackerIssueKey(text, options = {}) {
	const prompt = String(text ?? "");
	const knownQueues = normalizeKnownQueues(options);
	const direct = issueKeyPattern.exec(prompt)?.[0];
	if (direct) return direct.toUpperCase();

	const spaced = spacedIssueKeyPattern.exec(prompt);
	if (spaced) {
		const queue = resolveIssueQueue(spaced[1], {
			defaultQueue: options.defaultQueue,
			knownQueues,
		});
		const number = normalizeIssueNumber(spaced[2]);
		if (queue && number) return `${queue}-${number}`;
	}

	const bare = bareIssueNumberPattern.exec(prompt);
	const bareNumber = normalizeIssueNumberText(bare?.[1]);
	const defaultQueue = normalizeQueue(options.defaultQueue);
	if (bareNumber && defaultQueue) return `${defaultQueue}-${bareNumber}`;

	const tokenMatch = issueNumberFromTokens(prompt, options);
	return tokenMatch ? `${tokenMatch.queue}-${tokenMatch.number}` : undefined;
}

export function selectYandexTrackerTools(text, tools, options = {}) {
	const prompt = String(text ?? "");
	if (!trackerSignalPattern.test(prompt)) return undefined;

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
	if (searchPattern.test(prompt) || trackerSignalPattern.test(prompt))
		addIfAvailable(selected, availableToolNames, ["yandex_tracker_search"]);
	if (!selected.length) return undefined;

	return {
		mode: "assisted",
		category: "mcp_yandex_tracker",
		toolNames: selected.slice(0, 3),
	};
}
