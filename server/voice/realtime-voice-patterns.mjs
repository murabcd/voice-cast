const noOpTranscriptPatterns = [
	/^(?:\.|,|!|\?|…|\s)+$/,
	/^(?:мм+|м+|эм+|ээ+|эээ+|а+|ага|угу|ну)$/i,
	/^(?:тишина|молчание|шум|фоновый шум|background noise|silence|noise)$/i,
	/^(?:you|thank you|thanks|okay|ok|yeah|yep|yes|uh|um|hmm)[.!?]*$/i,
	/^(?:yeah|yes|yep),?\s+(?:i\s+think\s+)?(?:that'?s)?\.?$/i,
	/^(?:i\s+think\s+)?that'?s\.?$/i,
];

const russianToolPreambles = [
	"Секунду, прове́рю.",
	"Сейчас посмотрю.",
	"Уточню по источникам.",
	"Прове́рю и сразу отвечу.",
];

const englishToolPreambles = [
	"I'll check that.",
	"Let me verify that.",
	"I'll look that up.",
	"I'll check the sources.",
];

const unclearRussianTranscriptPatterns = [
	/^[A-Za-z\s'.!?-]{3,40}$/,
	/\b(?:has|sure|could|would|please|sorry|question|understand)\b/i,
	/^[А-Яа-яЁё]{1,4}\s+[А-Яа-яЁё]{1,4}[.!]*$/,
];

export function shouldWaitForUser(transcript) {
	const text = String(transcript ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	if (!text) return true;
	if (text.length <= 2) return true;
	return noOpTranscriptPatterns.some((pattern) => pattern.test(text));
}

export function shouldClarifyRussianTranscript(transcript) {
	const text = String(transcript ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	if (!text) return false;
	return unclearRussianTranscriptPatterns.some((pattern) => pattern.test(text));
}

export function pickToolPreamble({ language, turnId = 0 }) {
	const preambles =
		language === "en" ? englishToolPreambles : russianToolPreambles;
	return preambles[Math.abs(Number(turnId) || 0) % preambles.length];
}
