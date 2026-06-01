import { webRoutingPolicy } from "./policy/tool-routing-policy.mjs";
import { classifyUserTurn } from "./turn-classifier.mjs";

function matchesAny(patterns, text) {
	return patterns.some((pattern) => pattern.test(text));
}

function routeNamedEntityQuestion(prompt) {
	if (
		webRoutingPolicy.localConversationPatterns.some((pattern) =>
			pattern.test(prompt),
		)
	)
		return undefined;
	if (!webRoutingPolicy.namedEntityPattern.test(prompt)) return undefined;
	if (!webRoutingPolicy.questionPattern.test(prompt)) return undefined;
	return {
		mode: "assisted",
		category: "named_entity_question",
		toolNames: ["web_search", "web_fetch"],
	};
}

function selectWebRoute(prompt) {
	return (
		webRoutingPolicy.routes.find((route) =>
			matchesAny(route.patterns, prompt),
		) ?? routeNamedEntityQuestion(prompt)
	);
}

export function normalizeWebToolsEnabled(value) {
	return value !== false && value !== "false" && value !== "off";
}

export function selectToolsForTurn({ text, registry, webToolsEnabled = true }) {
	const prompt = String(text ?? "").trim();
	if (!prompt) return { kind: "none", category: "empty" };
	const turnType = classifyUserTurn(prompt);
	if (turnType !== "conversation") return { kind: "none", category: turnType };
	const localTool = registry.selectLocalTool(prompt);
	if (localTool) {
		return {
			kind: "direct_tool",
			category: "local_datetime",
			toolName: localTool.toolName,
			arguments: localTool.arguments,
		};
	}
	if (!webToolsEnabled)
		return { kind: "llm", category: "conversation", toolNames: [] };
	const webRoute = selectWebRoute(prompt);
	if (!webRoute)
		return { kind: "llm", category: "conversation", toolNames: [] };
	if (webRoute.mode === "direct") {
		return {
			kind: "direct_web",
			category: webRoute.category,
			toolNames: webRoute.toolNames,
		};
	}
	return {
		kind: "tool_assisted_llm",
		category: webRoute.category,
		toolNames: webRoute.toolNames,
	};
}
