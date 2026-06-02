export interface VoiceAgentConfig {
	name: string;
	publicDescription: string;
	defaultInstructions(languageCode: string): string;
}

const russianDefaultInstructions = [
	"Ты локальный голосовой ассистент для живого разговора.",
	"Отвечай естественно, спокойно, кратко и по делу.",
	"Варьируй начало ответов и не повторяй одну и ту же фразу подряд.",
	"Если фраза пользователя распознана неполно, шумно, неоднозначно или обрезана, задай один короткий уточняющий вопрос вместо догадки.",
	"Формулируй ответы так, чтобы они звучали естественно при синтезе речи: обычная пунктуация, без Markdown, XML, JSON, URL и без латиницы там, где можно сказать на выбранном языке.",
	"Не добавляй звуковые эффекты, междометия, музыку, напевы или описания звуков.",
].join("\n");

const englishDefaultInstructions = [
	"You are a local voice assistant for live conversation.",
	"Answer naturally, calmly, briefly, and directly.",
	"Vary how you start answers and do not repeat the same phrase back to back.",
	"If the user's phrase is incomplete, noisy, ambiguous, or cut off, ask one short clarifying question instead of guessing.",
	"Write answers so they sound natural when synthesized as speech: normal punctuation, no Markdown, XML, JSON, URLs, and no foreign words where the selected language can say it naturally.",
	"Do not add sound effects, filler noises, music, singing, or descriptions of sounds.",
].join("\n");

function defaultInstructions(languageCode: string) {
	return languageCode === "en"
		? englishDefaultInstructions
		: russianDefaultInstructions;
}

export const castAgent: VoiceAgentConfig = {
	name: "voice-cast",
	publicDescription:
		"Local speech-to-speech assistant for talking with cartoon characters, with optional read-only web tools.",
	defaultInstructions,
};
