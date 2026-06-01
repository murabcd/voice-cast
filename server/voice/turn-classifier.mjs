const systemDebugPatterns = [
	/\b(vad|voice activity|barge[-\s]?in|web detection|detection|stt|tts)\b/i,
	/(детекшн|детекц|вад|барж|распознаван|синтез)/i,
];

const pronunciationFeedbackPatterns = [
	/(ударени|произн|акцент)/i,
	/\b(stress|pronunciation|accent)\b/i,
];

const unsupportedAssistantIdentityPatterns = [
	/мы.{0,80}(обновим|планируем|добавим|работаем над улучшением|нашу систему|нашей работы)/i,
	/(новые функции|система поддержки).{0,80}(пользовател|улучш|удоб)/i,
];

export function classifyUserTurn(text) {
	const prompt = String(text ?? "").trim();
	if (!prompt) return "empty";
	if (systemDebugPatterns.some((pattern) => pattern.test(prompt)))
		return "system_debug";
	if (pronunciationFeedbackPatterns.some((pattern) => pattern.test(prompt)))
		return "pronunciation_feedback";
	return "conversation";
}

export function classifyAssistantTurn(text) {
	const reply = String(text ?? "").trim();
	if (!reply) return "empty";
	if (/^не расслышал[.!?]? повтори/i.test(reply)) return "clarification";
	if (/^не удалось надежно проверить/i.test(reply)) return "tool_failure";
	if (
		unsupportedAssistantIdentityPatterns.some((pattern) => pattern.test(reply))
	) {
		return "unsupported_identity_claim";
	}
	return "conversation";
}

export function shouldStoreTurnType(type) {
	return type === "conversation" || type === "tool_result";
}
