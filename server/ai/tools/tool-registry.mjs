import {
	callLocalDateTimeTool,
	localDateTimeNamespace,
	selectLocalDateTimeTool,
} from "./local-date-time-tools.mjs";

const webNamespace = {
	name: "web",
	description:
		"Read-only external information tools. Use for explicit online lookup, current facts, public websites, documentation, prices, weather, schedules, and sources that may have changed.",
};

function scopeToolManager(toolManager, toolNames) {
	const selected = new Set(toolNames);
	const tools = (toolManager?.tools ?? []).filter((tool) =>
		selected.has(tool.name),
	);
	return {
		enabled: tools.length > 0 && toolManager?.enabled !== false,
		tools,
		callTool: async (name, args, options) => {
			if (!selected.has(name)) throw new Error(`Tool is not selected: ${name}`);
			return await toolManager.callTool(name, args, options);
		},
	};
}

export function buildVoiceToolRegistry({ settings, webTools }) {
	const localTools = new Map(
		localDateTimeNamespace.tools.map((tool) => [tool.name, tool]),
	);
	const webToolDefinitions = (webTools?.tools ?? []).map((tool) => ({
		...tool,
		namespace: "web",
		execution: "remote",
	}));
	const webToolMap = new Map(
		webToolDefinitions.map((tool) => [tool.name, tool]),
	);
	return {
		namespaces: [
			localDateTimeNamespace,
			{ ...webNamespace, tools: webToolDefinitions },
		],
		selectLocalTool(text) {
			return selectLocalDateTimeTool(text);
		},
		async callTool(name, args, { signal } = {}) {
			if (localTools.has(name)) {
				return callLocalDateTimeTool({
					toolName: name,
					arguments: args,
					timeZone: settings.timeZone,
					language: settings.language,
				});
			}
			if (webToolMap.has(name))
				return await webTools.callTool(name, args, { signal });
			throw new Error(`Unknown voice tool: ${name}`);
		},
		toolsFor(names) {
			const selected = new Set(names);
			return [...localTools.values(), ...webToolDefinitions].filter((tool) =>
				selected.has(tool.name),
			);
		},
		toolManagerFor(names) {
			return scopeToolManager(webTools, names);
		},
	};
}
