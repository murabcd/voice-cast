import {
	callLocalDateTimeTool,
	localDateTimeNamespace,
	selectLocalDateTimeTool,
} from "./local-date-time-tools.mjs";
import { createYandexTrackerMcpFacade } from "./yandex-tracker-mcp-facade.mjs";
import { selectYandexTrackerTools } from "./yandex-tracker-routing.mjs";

const webNamespace = {
	name: "web",
	description:
		"Read-only external information tools. Use for explicit online lookup, current facts, public websites, documentation, prices, weather, schedules, and sources that may have changed.",
};

function combineToolManagers(managers, toolNames) {
	const selected = new Set(toolNames);
	const tools = managers
		.flatMap((manager) => manager?.tools ?? [])
		.filter((tool) => selected.has(tool.name));
	const toolOwners = new Map();
	for (const manager of managers) {
		for (const tool of manager?.tools ?? []) {
			if (selected.has(tool.name)) toolOwners.set(tool.name, manager);
		}
	}
	return {
		enabled:
			tools.length > 0 &&
			tools.every((tool) => toolOwners.get(tool.name)?.enabled !== false),
		tools,
		callTool: async (name, args, options) => {
			if (!selected.has(name)) throw new Error(`Tool is not selected: ${name}`);
			const owner = toolOwners.get(name);
			if (!owner) throw new Error(`Selected tool is not available: ${name}`);
			return await owner.callTool(name, args, options);
		},
	};
}

export function buildVoiceToolRegistry({
	settings,
	webTools,
	mcpTools,
	trackerDefaultQueue,
	trackerLimitQueues,
}) {
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
	const trackerTools = createYandexTrackerMcpFacade(mcpTools);
	const mcpToolDefinitions = (trackerTools.tools ?? []).map((tool) => ({
		...tool,
		namespace: "mcp",
		execution: "remote",
	}));
	const mcpToolMap = new Map(
		mcpToolDefinitions.map((tool) => [tool.name, tool]),
	);
	return {
		namespaces: [
			localDateTimeNamespace,
			{ ...webNamespace, tools: webToolDefinitions },
			{
				name: "mcp",
				description:
					"Configured MCP tools for private workspace systems. Use only for explicit requests about those systems.",
				tools: mcpToolDefinitions,
			},
		],
		selectLocalTool(text) {
			return selectLocalDateTimeTool(text);
		},
		selectMcpTools(text) {
			if (!mcpToolDefinitions.length) return undefined;
			return selectYandexTrackerTools(text, mcpToolDefinitions, {
				defaultQueue: trackerDefaultQueue,
				limitQueues: trackerLimitQueues,
			});
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
			if (mcpToolMap.has(name))
				return await trackerTools.callTool(name, args, { signal });
			throw new Error(`Unknown voice tool: ${name}`);
		},
		toolsFor(names) {
			const selected = new Set(names);
			return [
				...localTools.values(),
				...webToolDefinitions,
				...mcpToolDefinitions,
			].filter((tool) => selected.has(tool.name));
		},
		toolManagerFor(names) {
			return combineToolManagers([webTools, trackerTools], names);
		},
	};
}
