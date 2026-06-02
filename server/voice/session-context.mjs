const languageNames = new Map([
	["ru", "Russian"],
	["en", "English"],
	["es", "Spanish"],
	["fr", "French"],
	["de", "German"],
	["it", "Italian"],
	["pt", "Portuguese"],
	["ja", "Japanese"],
	["ko", "Korean"],
	["uk", "Ukrainian"],
	["ar", "Arabic"],
	["bg", "Bulgarian"],
	["cs", "Czech"],
	["da", "Danish"],
	["el", "Greek"],
	["et", "Estonian"],
]);

export function runtimeSessionContext({ language } = {}) {
	const languageName = languageNames.get(language) ?? "Russian";
	return [
		"## Voice Session Context",
		`Selected interface language: ${languageName}. Reply in ${languageName}.`,
		`Keep tool bridges and final answers in ${languageName}.`,
		"Do not switch language because of accent, filler words, names, addresses, or isolated foreign words.",
		"Direct answers: 1-2 short sentences.",
		"Clarifying questions: ask one question at a time.",
		"Tool results: summarize the result first, then give only the next useful detail.",
		"Do not mention tool names, JSON, XML, Markdown, or URLs.",
		"If reading a code, number, identifier, or mixed letter-digit value, read the characters separately and do not omit any character.",
	].join("\n");
}
