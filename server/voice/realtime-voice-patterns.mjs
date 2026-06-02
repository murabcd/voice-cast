import { realtimeVoicePolicy } from "./policy/turn-policy.mjs";

export function shouldWaitForUser(transcript) {
	const text = String(transcript ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	if (!text) return true;
	if (text.length <= 2) return true;
	return realtimeVoicePolicy.isNoOpTranscript(text);
}

export function shouldClarifyRussianTranscript(transcript) {
	const text = String(transcript ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	if (!text) return false;
	return realtimeVoicePolicy.isUnclearRussianTranscript(text);
}

export function pickToolPreamble({ language, turnId = 0 }) {
	const preambles =
		realtimeVoicePolicy.toolPreambles[language] ??
		realtimeVoicePolicy.toolPreambles.ru;
	return preambles[Math.abs(Number(turnId) || 0) % preambles.length];
}
