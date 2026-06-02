import { resolveCharacterPreset } from "./character-context.mjs";
import {
	supertonicLanguages,
	supertonicVoiceNames,
} from "./supertonic-tts-worker.mjs";
import { normalizeWebToolsEnabled } from "./tool-selector.mjs";

function parseNumber(value, { min, max }) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return undefined;
	if (parsed < min || parsed > max) return undefined;
	return parsed;
}

export function parseClientSettingsMessage(msg) {
	const maxTokens = Number(msg.maxTokens);
	const characterId = Number(msg.characterId);
	const language = String(msg.language ?? "").trim();
	const voiceName = String(msg.voiceName ?? "").trim();
	const autoGreetingEnabled = msg.autoGreetingEnabled !== false;
	const character = resolveCharacterPreset(characterId);
	return {
		settings: {
			autoGreetingEnabled,
			systemPrompt: String(msg.baseSystemPrompt ?? "").trim(),
			characterId: character?.id,
			language: supertonicLanguages.has(language) ? language : undefined,
			voiceName: supertonicVoiceNames.has(voiceName) ? voiceName : undefined,
			maxTokens:
				Number.isInteger(maxTokens) && maxTokens > 0 ? maxTokens : undefined,
			temperature: parseNumber(msg.temperature, { min: 0, max: 2 }),
			topP: parseNumber(msg.topP, { min: 0, max: 1 }),
			repeatPenalty: parseNumber(msg.repeatPenalty, { min: 1, max: 2 }),
			webToolsEnabled: normalizeWebToolsEnabled(msg.webToolsEnabled),
		},
		logFields: {
			language,
			autoGreetingEnabled,
			characterId,
			voiceName,
			systemPromptPreview: String(msg.baseSystemPrompt ?? "").slice(0, 120),
		},
	};
}
