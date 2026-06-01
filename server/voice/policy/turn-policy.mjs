export const turnClassifierPolicy = {
	systemDebugPatterns: [
		/\b(vad|voice activity|barge[-\s]?in|web detection|detection|stt|tts)\b/i,
		/(детекшн|детекц|вад|барж|распознаван|синтез)/i,
	],
	pronunciationFeedbackPatterns: [
		/(ударени|произн|акцент)/i,
		/\b(stress|pronunciation|accent)\b/i,
	],
	unsupportedAssistantIdentityPatterns: [
		/мы.{0,80}(обновим|планируем|добавим|работаем над улучшением|нашу систему|нашей работы)/i,
		/(новые функции|система поддержки).{0,80}(пользовател|улучш|удоб)/i,
	],
	assistantClarificationPattern: /^не расслышал[.!?]? повтори/i,
	assistantToolFailurePattern: /^не удалось надежно проверить/i,
};

export const realtimeVoicePolicy = {
	noOpTranscriptPatterns: [
		/^(?:\.|,|!|\?|…|\s)+$/,
		/^(?:мм+|м+|эм+|ээ+|эээ+|а+|ага|угу|ну)$/i,
		/^(?:тишина|молчание|шум|фоновый шум|background noise|silence|noise)$/i,
		/^(?:you|thank you|thanks|okay|ok|yeah|yep|yes|uh|um|hmm)[.!?]*$/i,
		/^(?:yeah|yes|yep),?\s+(?:i\s+think\s+)?(?:that'?s)?\.?$/i,
		/^(?:i\s+think\s+)?that'?s\.?$/i,
	],
	toolPreambles: {
		ru: [
			"Секунду, прове́рю.",
			"Сейчас посмотрю.",
			"Уточню по источникам.",
			"Прове́рю и сразу отвечу.",
		],
		en: [
			"I'll check that.",
			"Let me verify that.",
			"I'll look that up.",
			"I'll check the sources.",
		],
	},
	unclearRussianTranscriptPatterns: [
		/^[A-Za-z\s'.!?-]{3,40}$/,
		/\b(?:has|sure|could|would|please|sorry|question|understand)\b/i,
		/^[А-Яа-яЁё]{1,4}\s+[А-Яа-яЁё]{1,4}[.!]*$/,
	],
};
