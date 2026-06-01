import { classifyUserTurn } from "./turn-classifier.mjs";

const webRoutes = [
	{
		mode: "direct",
		category: "fresh_external",
		toolNames: ["web_search"],
		patterns: [
			/\b(search|google|browse|look\s+up|find\s+online|check\s+online)\b/i,
			/\b[a-z0-9-]+\s*\.\s*(com|ru|io|ai|dev|org|net)\b/i,
			/(?=.*(зайди|выйди|открой|найди|поищи|загугли|посмотри|провер(?:ь|ить)))(?=.*(интернет|сети|веб|онлайн|сайт|браузер))/i,
			/(посмотри|провер(?:ь|ить)).{0,40}(?:по\s+)?компани[юиея]/i,
			/(?:^|[^А-Яа-яЁё])(погода|температура|прогноз)(?:$|[^А-Яа-яЁё])/i,
			/\b(weather|forecast)\b/i,
			/(букв|латиниц|по буквам).*[A-ZА-Я](?:[\s,.-]+[A-ZА-Я]){2,}/i,
		],
	},
	{
		mode: "assisted",
		category: "external_topic",
		toolNames: ["web_search", "web_fetch"],
		patterns: [
			/\b(search|google|browse|web|internet|online|look\s+up|find\s+online)\b/i,
			/\b(latest|current|recent|today|yesterday|tomorrow|news|price|weather|schedule)\b/i,
			/\b(company|website|site|docs?|documentation|github|hugging\s*face)\b/i,
			/(?:^|[^А-Яа-яЁё])(в интернете|в сети|актуальн|свеж|последн|новост|цена|погода|расписан)(?:$|[^А-Яа-яЁё])/i,
			/(?:^|[^А-Яа-яЁё])(компани[яиею]|сайт|документац|github|hugging\s*face)(?:$|[^А-Яа-яЁё])/i,
		],
	},
];

const localConversationPatterns = [
	/^(привет|здравствуй|слушай|давай|окей|хорошо|ага|да|нет)\b/i,
	/\b(расскажи о себе|что ты умеешь|кто ты|ты меня слышишь)\b/i,
	/^(hi|hello|hey|ok|okay|yes|no)\b/i,
	/\b(tell me about yourself|what can you do|can you hear me)\b/i,
];

function matchesAny(patterns, text) {
	return patterns.some((pattern) => pattern.test(text));
}

function routeNamedEntityQuestion(prompt) {
	if (localConversationPatterns.some((pattern) => pattern.test(prompt)))
		return undefined;
	if (!/[A-Z][A-Za-z0-9-]{2,}/.test(prompt)) return undefined;
	if (!/\b(what|who|where|when|какой|какая|кто|где|когда|что)\b/i.test(prompt))
		return undefined;
	return {
		mode: "assisted",
		category: "named_entity_question",
		toolNames: ["web_search", "web_fetch"],
	};
}

function selectWebRoute(prompt) {
	return (
		webRoutes.find((route) => matchesAny(route.patterns, prompt)) ??
		routeNamedEntityQuestion(prompt)
	);
}

export function normalizeWebToolsEnabled(value) {
	return value !== false && value !== "false" && value !== "off";
}

export function selectToolsForTurn({ text, registry, webToolsEnabled = true }) {
	const prompt = String(text ?? "").trim();
	if (!prompt) return { kind: "none", category: "empty" };
	const turnType = classifyUserTurn(prompt);
	if (turnType !== "conversation") return { kind: "none", category: turnType };
	const localTool = registry.selectLocalTool(prompt);
	if (localTool) {
		return {
			kind: "direct_tool",
			category: "local_datetime",
			toolName: localTool.toolName,
			arguments: localTool.arguments,
		};
	}
	if (!webToolsEnabled)
		return { kind: "llm", category: "conversation", toolNames: [] };
	const webRoute = selectWebRoute(prompt);
	if (!webRoute)
		return { kind: "llm", category: "conversation", toolNames: [] };
	if (webRoute.mode === "direct") {
		return {
			kind: "direct_web",
			category: webRoute.category,
			toolNames: webRoute.toolNames,
		};
	}
	return {
		kind: "tool_assisted_llm",
		category: webRoute.category,
		toolNames: webRoute.toolNames,
	};
}
