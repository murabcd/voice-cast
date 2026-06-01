const noOpTranscriptPatterns = [
	/^(?:\.|,|!|\?|…|\s)+$/,
	/^(?:мм+|м+|эм+|ээ+|эээ+|а+|ага|угу|ну)$/i,
	/^(?:тишина|молчание|шум|фоновый шум|background noise|silence|noise)$/i,
	/^(?:you|thank you|thanks|okay|ok)$/i,
];

const russianToolPreambles = [
	"Секунду, проверю.",
	"Сейчас посмотрю.",
	"Уточню по источникам.",
	"Проверю и сразу отвечу.",
];

const englishToolPreambles = [
	"I'll check that.",
	"Let me verify that.",
	"I'll look that up.",
	"I'll check the sources.",
];

export function shouldWaitForUser(transcript) {
	const text = String(transcript ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	if (!text) return true;
	if (text.length <= 2) return true;
	return noOpTranscriptPatterns.some((pattern) => pattern.test(text));
}

export function pickToolPreamble({ language, turnId = 0 }) {
	const preambles =
		language === "en" ? englishToolPreambles : russianToolPreambles;
	return preambles[Math.abs(Number(turnId) || 0) % preambles.length];
}
