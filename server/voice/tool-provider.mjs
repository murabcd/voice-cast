const webToolNames = new Set(["web_search", "web_fetch"]);

export function toolProvider(name) {
	const toolName = String(name ?? "");
	if (webToolNames.has(toolName)) return "web";
	if (toolName.startsWith("yandex_tracker_")) return "yandex-tracker";
	return undefined;
}

export function isWebToolName(name) {
	return toolProvider(name) === "web";
}
