import { isWebToolName } from "./tool-provider.mjs";

function compactText(value, maxLength = 260) {
	return String(value ?? "")
		.replaceAll(/\s+/g, " ")
		.trim()
		.slice(0, maxLength);
}

export function webTaskFromTurnLog(logEvent) {
	const toolNames = Array.isArray(logEvent?.tool_names)
		? logEvent.tool_names
		: [];
	const usedWeb = toolNames.some(isWebToolName);
	if (!usedWeb) return undefined;

	const routeArguments =
		logEvent?.tool_route_arguments &&
		typeof logEvent.tool_route_arguments === "object"
			? logEvent.tool_route_arguments
			: {};
	const url = compactText(routeArguments.url, 240);
	const query = compactText(
		logEvent?.tool_route_query || logEvent?.transcript,
		260,
	);

	if (toolNames.includes("web_fetch") && url) {
		return {
			kind: "page",
			tool: "web_fetch",
			url,
			query,
		};
	}

	if (toolNames.includes("web_search") && query) {
		return {
			kind: "search",
			tool: "web_search",
			query,
		};
	}

	return undefined;
}
