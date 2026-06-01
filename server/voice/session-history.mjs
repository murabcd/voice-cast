import {
	classifyAssistantTurn,
	classifyUserTurn,
	shouldStoreTurnType,
} from "./turn-classifier.mjs";

const maxTurns = 4;
const maxTextLength = 360;

const repeatRequestPatterns = [
	/(?:^|\s)повтори(?:\s|$)/i,
	/(?:^|\s)(?:ещ[её]|еще)\s+раз(?:\s|$)/i,
	/(?:^|\s)что\s+ты\s+(?:сказал|говорил)(?:\s|$)/i,
	/\brepeat\b/i,
	/\bsay\s+that\s+again\b/i,
	/\bwhat\s+did\s+you\s+say\b/i,
];

function compactText(value) {
	return String(value ?? "")
		.replaceAll(/\s+/g, " ")
		.trim()
		.slice(0, maxTextLength);
}

export function shouldRememberTurn({ user, assistant }) {
	const userText = compactText(user);
	const assistantText = compactText(assistant);
	if (!userText || !assistantText) return false;
	if (isRepeatLastAnswerRequest(userText)) return false;
	return (
		shouldStoreTurnType(classifyUserTurn(userText)) &&
		shouldStoreTurnType(classifyAssistantTurn(assistantText))
	);
}

export function isRepeatLastAnswerRequest(text) {
	const prompt = compactText(text);
	return repeatRequestPatterns.some((pattern) => pattern.test(prompt));
}

export function createSessionHistory() {
	const turns = [];
	return {
		add({ user, assistant }) {
			if (!shouldRememberTurn({ user, assistant })) return;
			const userText = compactText(user);
			const assistantText = compactText(assistant);
			turns.push({ user: userText, assistant: assistantText });
			while (turns.length > maxTurns) turns.shift();
		},
		lastAssistant() {
			return turns.at(-1)?.assistant;
		},
		size() {
			return turns.length;
		},
		messages() {
			return turns.flatMap((turn) => [
				{ role: "user", content: turn.user },
				{ role: "assistant", content: turn.assistant },
			]);
		},
	};
}
