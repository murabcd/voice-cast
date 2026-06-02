import { turnClassifierPolicy } from "./policy/turn-policy.mjs";

export function classifyUserTurn(text) {
	const prompt = String(text ?? "").trim();
	if (!prompt) return "empty";
	if (turnClassifierPolicy.isSystemDebug(prompt)) return "system_debug";
	if (turnClassifierPolicy.isPronunciationFeedback(prompt))
		return "pronunciation_feedback";
	return "conversation";
}

export function classifyAssistantTurn(text) {
	const reply = String(text ?? "").trim();
	if (!reply) return "empty";
	if (turnClassifierPolicy.isAssistantClarification(reply))
		return "clarification";
	if (turnClassifierPolicy.isAssistantToolFailure(reply)) return "tool_failure";
	if (turnClassifierPolicy.isUnsupportedAssistantIdentityClaim(reply)) {
		return "unsupported_identity_claim";
	}
	return "conversation";
}

export function shouldStoreTurnType(type) {
	return type === "conversation" || type === "tool_result";
}
