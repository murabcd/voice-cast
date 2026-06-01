const explicitWebPatterns = [
	/\b(search|google|browse|web|internet|online|look\s+up|find\s+online)\b/i,
	/\b(latest|current|recent|today|yesterday|tomorrow|news|price|weather|schedule)\b/i,
	/\b(company|website|site|docs?|documentation|github|hugging\s*face)\b/i,
	/(найди|поищи|загугли|посмотри|проверь|интернет|сети|веб|онлайн)/i,
	/(найди|поищи|загугли|посмотри|проверь).*(интернет|сети|веб|онлайн)/i,
	/\b(в интернете|в сети|онлайн|актуальн|свеж|последн|новост|цена|погода|расписан)\b/i,
	/\b(компани[яи]|сайт|документац|github|hugging\s*face)\b/i,
];

const localConversationPatterns = [
	/^(привет|здравствуй|слушай|давай|окей|хорошо|ага|да|нет)\b/i,
	/\b(расскажи о себе|что ты умеешь|кто ты|ты меня слышишь)\b/i,
	/^(hi|hello|hey|ok|okay|yes|no)\b/i,
	/\b(tell me about yourself|what can you do|can you hear me)\b/i,
];

export function shouldUseWebTools(text) {
	const prompt = String(text ?? "").trim();
	if (!prompt) return false;
	if (explicitWebPatterns.some((pattern) => pattern.test(prompt))) return true;
	return (
		!localConversationPatterns.some((pattern) => pattern.test(prompt)) &&
		/[A-Z][A-Za-z0-9-]{2,}/.test(prompt) &&
		/\b(what|who|where|when|какой|какая|кто|где|когда|что)\b/i.test(prompt)
	);
}

export function normalizeWebToolsEnabled(value) {
	return value !== false && value !== "false" && value !== "off";
}
