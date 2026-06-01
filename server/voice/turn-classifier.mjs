import { turnClassifierPolicy } from "./policy/turn-policy.mjs";

export function classifyUserTurn(text) {
	const prompt = String(text ?? "").trim();
	if (!prompt) return "empty";
	if (
		turnClassifierPolicy.systemDebugPatterns.some((pattern) =>
			pattern.test(prompt),
		)
	)
		return "system_debug";
	if (
		turnClassifierPolicy.pronunciationFeedbackPatterns.some((pattern) =>
			pattern.test(prompt),
		)
	)
		return "pronunciation_feedback";
	return "conversation";
}

export function classifyAssistantTurn(text) {
	const reply = String(text ?? "").trim();
	if (!reply) return "empty";
	if (turnClassifierPolicy.assistantClarificationPattern.test(reply))
		return "clarification";
	if (turnClassifierPolicy.assistantToolFailurePattern.test(reply))
		return "tool_failure";
	if (
		turnClassifierPolicy.unsupportedAssistantIdentityPatterns.some((pattern) =>
			pattern.test(reply),
		)
	) {
		return "unsupported_identity_claim";
	}
	return "conversation";
}

export function shouldStoreTurnType(type) {
	return type === "conversation" || type === "tool_result";
}
