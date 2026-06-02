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

function buildFollowUpSearchQuery(prompt, webContext) {
	const previousUser = String(webContext?.user ?? "").trim();
	if (!previousUser) return prompt;
	return `${previousUser}\nFollow-up: ${prompt}`;
}

function routeWebFollowUp(prompt, webContext) {
	if (!webContext?.metadata?.usedWeb) return undefined;
	if (matchesAny(webRoutingPolicy.localFollowUpPatterns, prompt))
		return undefined;
	const route = webRoutingPolicy.followUpRoutes.find((candidate) =>
		matchesAny(candidate.patterns, prompt),
	);
	if (!route) return undefined;
	return {
		mode: "direct",
		category: route.category,
		toolNames: route.toolNames,
		query: buildFollowUpSearchQuery(prompt, webContext),
	};
}

export function normalizeWebToolsEnabled(value) {
	return value !== false && value !== "false" && value !== "off";
}

export function selectToolsForTurn({
	text,
	registry,
	webContext,
	webToolsEnabled = true,
}) {
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
	const mcpRoute = registry.selectMcpTools(prompt);
	if (mcpRoute) {
		if (mcpRoute.mode === "direct") {
			return {
				kind: "direct_tool_result",
				category: mcpRoute.category,
				toolName: mcpRoute.toolName,
				arguments: mcpRoute.arguments,
			};
		}
		return {
			kind: "tool_assisted_llm",
			category: mcpRoute.category,
			toolNames: mcpRoute.toolNames,
		};
	}
	if (!webToolsEnabled)
		return { kind: "llm", category: "conversation", toolNames: [] };
	const webFollowUp = routeWebFollowUp(prompt, webContext);
	if (webFollowUp) {
		return {
			kind: "direct_web",
			category: webFollowUp.category,
			toolNames: webFollowUp.toolNames,
			query: webFollowUp.query,
		};
	}
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
