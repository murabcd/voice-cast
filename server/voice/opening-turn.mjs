const openingReplies = {
	en: "Hi, I am ready. What would you like to talk about?",
	ru: "Привет, я на связи. О чем поговорим?",
};

export function openingReplyForSettings(settings = {}) {
	return openingReplies[settings.language] ?? openingReplies.ru;
}
