const capabilityQuestionPatterns = [
	/\bwhat can you do\b/i,
	/\bwhat are your capabilities\b/i,
	/\bwhat tools do you have\b/i,
	/\bwhat can this app do\b/i,
	/\bcan you (send|write).*\b(email|message|sms|notification)\b/i,
	/\bcan you (book|buy|purchase|change|modify).*\b/i,
	/\bcan you (read|open|access).*\b(my )?(files|private accounts|account)\b/i,
	/что ты умеешь/i,
	/что умеешь/i,
	/какие у тебя (есть )?(возможности|функции)/i,
	/что ты можешь/i,
	/какие инструменты/i,
	/можешь.*(отправить|написать).*(письмо|сообщение|смс|уведомление)/i,
	/можешь.*(забронировать|купить|изменить|поменять)/i,
	/можешь.*(прочитать|открыть|получить доступ).*(файл|аккаунт|счет)/i,
];

function hasTool(registry, namespaceName, toolName) {
	const namespace = registry.namespaces.find(
		(candidate) => candidate.name === namespaceName,
	);
	return (namespace?.tools ?? []).some((tool) => tool.name === toolName);
}

function webLookupAvailable({ registry, settings, webTools }) {
	return (
		settings.webToolsEnabled !== false &&
		webTools?.enabled === true &&
		hasTool(registry, "web", "web_search")
	);
}

function trackerAvailable({ registry, mcpTools }) {
	return (
		mcpTools?.enabled === true &&
		(hasTool(registry, "mcp", "yandex_tracker_get_issue") ||
			hasTool(registry, "mcp", "yandex_tracker_search"))
	);
}

function localDateTimeAvailable(registry) {
	return (
		(
			registry.namespaces.find(
				(namespace) => namespace.name === "local_datetime",
			)?.tools ?? []
		).length > 0
	);
}

export function isCapabilityQuestion(text) {
	const prompt = String(text ?? "").trim();
	if (!prompt) return false;
	return capabilityQuestionPatterns.some((pattern) => pattern.test(prompt));
}

export function buildRuntimeCapabilities({
	registry,
	settings = {},
	webTools,
	mcpTools,
}) {
	const hasDateTime = localDateTimeAvailable(registry);
	const hasWebLookup = webLookupAvailable({ registry, settings, webTools });
	const hasTracker = trackerAvailable({ registry, mcpTools });
	return {
		dateTime: hasDateTime,
		language: settings.language === "en" ? "en" : "ru",
		tracker: hasTracker,
		webLookup: hasWebLookup,
		weather: hasWebLookup,
	};
}

export function runtimeCapabilityContext(capabilities) {
	const available = [
		"spoken conversation and general answers from local model knowledge",
		capabilities.dateTime
			? "current date, time, and weekday through local deterministic tools"
			: undefined,
		capabilities.webLookup
			? "read-only public web lookup for current external information"
			: undefined,
		capabilities.tracker
			? "read-only Yandex Tracker issue lookup and search"
			: undefined,
	].filter(Boolean);
	const unavailable = [
		capabilities.weather ? undefined : "weather lookup",
		"sending messages, emails, calls, or notifications",
		"booking, purchasing, or modifying external systems",
		"reading local files or private accounts unless a configured tool for that exact source is available",
	].filter(Boolean);
	return [
		"## Runtime Capabilities",
		"Use this section as the source of truth for what this app can do right now.",
		"Do not claim capabilities that are not listed as available.",
		"If the user asks for an unavailable capability, say it is not available in this app right now and offer the closest available alternative.",
		"",
		"Available now:",
		...available.map((item) => `- ${item}`),
		"",
		"Unavailable now:",
		...unavailable.map((item) => `- ${item}`),
	].join("\n");
}

export function capabilityReply(capabilities) {
	if (capabilities.language === "en") {
		const parts = ["I can talk with you and answer general questions"];
		if (capabilities.dateTime) parts.push("tell the current date or time");
		if (capabilities.webLookup)
			parts.push("look up current public information on the web");
		if (capabilities.tracker) parts.push("read Yandex Tracker issues");
		return `${parts.join(", ")}. I cannot send messages, make bookings, change external systems, or access private data unless this app has a configured tool for that exact action.`;
	}
	const parts = ["Я могу разговаривать с тобой и отвечать на общие вопросы"];
	if (capabilities.dateTime) parts.push("сказать текущую дату или время");
	if (capabilities.webLookup)
		parts.push("искать актуальную публичную информацию в интернете");
	if (capabilities.tracker) parts.push("читать задачи в Яндекс Трекере");
	return `${parts.join(", ")}. Я не могу отправлять сообщения, бронировать, менять внешние системы или читать приватные данные без настроенного инструмента для такого действия.`;
}
