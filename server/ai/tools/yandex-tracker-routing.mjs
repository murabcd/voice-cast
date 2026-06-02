const trackerSignalPattern =
	/(tracker|yandex|яндекс|трекер|задач[аиу]?|тикет|issue|queue|очеред[ьи])/i;
const issueKeyPattern = /\b[A-Z][A-Z0-9]+-\d+\b/i;
const spacedIssueKeyPattern =
	/\b([A-Z][A-Z0-9]{1,20})\s+(?:номер\s*)?((?:\d[\s.:-]*){1,16})\b/i;
const bareIssueNumberPattern =
	/(?:номер(?:ом)?|задач[аиу]?|тикет|issue|ticket)\D{0,24}((?:\d[\s.:-]*){1,16})\b/i;
const searchPattern =
	/(find|search|list|найди|найти|поищи|поиск|покажи|список|все|всё|очеред[ьи]|статус|приоритет|пользовател|исполнител|assignee|автор|сколько|количеств)/i;

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

	const queue = normalizeQueue(options.defaultQueue);
	if (!queue) return undefined;
	const bare = bareIssueNumberPattern.exec(prompt);
	if (!bare) return undefined;
	const number = normalizeIssueNumber(bare[1]);
	return number ? `${queue}-${number}` : undefined;
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
