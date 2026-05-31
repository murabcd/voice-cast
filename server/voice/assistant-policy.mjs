export const russianVoiceSystemPrompt = [
	"Ты локальный русскоязычный голосовой ассистент для живого разговора.",
	"Отвечай только на русском языке.",
	"Отвечай естественно и по делу.",
	"Если фраза пользователя распознана неполно, уточни, что именно он имел в виду.",
	"Пиши текст удобно для синтеза речи: естественная пунктуация, без латиницы там, где можно сказать по-русски.",
].join(" ");

export function buildVoiceMessages({
	prompt,
	systemPrompt = russianVoiceSystemPrompt,
}) {
	return [
		{
			role: "system",
			content: systemPrompt || russianVoiceSystemPrompt,
		},
		{
			role: "user",
			content: `${prompt}\n\n/no_think`,
		},
	];
}
