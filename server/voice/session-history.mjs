import { hasAnyPhrase, normalizeIntentText } from "./intent-text.mjs";
import {
	classifyAssistantTurn,
	classifyUserTurn,
	shouldStoreTurnType,
} from "./turn-classifier.mjs";

const maxTurns = 4;
const maxTextLength = 360;
const maxSummaryLength = 900;
const maxSummaryTextLength = 120;

const repeatRequestPhrases = [
	"repeat",
	"say that again",
	"what did you say",
	"повтори",
	"повтори еще раз",
	"повтори ещё раз",
	"произнеси еще раз",
	"произнеси ещё раз",
	"скажи еще раз",
	"скажи ещё раз",
	"что ты говорил",
	"что ты сказал",
];

function compactText(value, maxLength = maxTextLength) {
	return String(value ?? "")
		.replaceAll(/\s+/g, " ")
		.trim()
		.slice(0, maxLength);
}

function compactSummary(value) {
	return String(value ?? "")
		.replaceAll(/\s+/g, " ")
		.trim()
		.slice(0, maxSummaryLength);
}

function summarizeTurn(turn) {
	const user = compactText(turn.user, maxSummaryTextLength);
	const assistant = compactText(turn.assistant, maxSummaryTextLength);
	if (!user || !assistant) return "";
	return `Пользователь: ${user} Ответ: ${assistant}`;
}

function mergeSummary(currentSummary, turn) {
	const turnSummary = summarizeTurn(turn);
	if (!turnSummary) return currentSummary;
	return compactSummary(
		[currentSummary, turnSummary].filter(Boolean).join(" "),
	);
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
	return hasAnyPhrase(
		normalizeIntentText(compactText(text)),
		repeatRequestPhrases,
	);
}

export function createSessionHistory() {
	const turns = [];
	let summary = "";
	return {
		add({ user, assistant, metadata }) {
			if (!shouldRememberTurn({ user, assistant })) return;
			const userText = compactText(user);
			const assistantText = compactText(assistant);
			turns.push({
				user: userText,
				assistant: assistantText,
				metadata: metadata && typeof metadata === "object" ? metadata : {},
			});
			while (turns.length > maxTurns) {
				const compactedTurn = turns.shift();
				summary = mergeSummary(summary, compactedTurn);
			}
		},
		lastAssistant() {
			return turns.at(-1)?.assistant;
		},
		size() {
			return turns.length;
		},
		summary() {
			return summary;
		},
		summaryChars() {
			return summary.length;
		},
		messageChars() {
			return this.messages().reduce(
				(total, message) => total + message.content.length,
				0,
			);
		},
		messages() {
			const recentMessages = turns.flatMap((turn) => [
				{ role: "user", content: turn.user },
				{ role: "assistant", content: turn.assistant },
			]);
			if (!summary) return recentMessages;
			return [
				{
					role: "system",
					content: `Краткая память предыдущего разговора: ${summary}`,
				},
				...recentMessages,
			];
		},
		webContext() {
			for (let index = turns.length - 1; index >= 0; index -= 1) {
				if (turns[index].metadata?.usedWeb === true) return turns[index];
			}
			return undefined;
		},
	};
}
