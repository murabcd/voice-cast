import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function normalizeInputSchema(tool) {
	const schema =
		tool?.inputSchema && typeof tool.inputSchema === "object"
			? tool.inputSchema
			: {};
	return {
		type: "object",
		properties:
			schema.properties && typeof schema.properties === "object"
				? schema.properties
				: {},
		required: Array.isArray(schema.required) ? schema.required : [],
		additionalProperties: schema.additionalProperties === true,
	};
}

function normalizeContentItem(item) {
	if (!item || typeof item !== "object") return undefined;
	if (item.type === "text")
		return { type: "text", text: String(item.text ?? "") };
	if (item.type === "resource")
		return {
			type: "resource",
			resource: {
				uri: String(item.resource?.uri ?? ""),
				text: String(item.resource?.text ?? ""),
			},
		};
	return { type: item.type ?? "unknown" };
}

function normalizeToolResult(result) {
	const content = Array.isArray(result?.content)
		? result.content.map((item) => normalizeContentItem(item)).filter(Boolean)
		: [];
	const normalized = {
		isError: result?.isError === true,
		content,
	};
	if (
		result?.structuredContent &&
		typeof result.structuredContent === "object" &&
		!Array.isArray(result.structuredContent)
	) {
		normalized.structuredContent = result.structuredContent;
	}
	return normalized;
}

export class McpTools {
	constructor({
		servers = [],
		createClient = (server) =>
			new Client({
				name: `voice-cast-${server.name}`,
				version: "1.0.0",
			}),
	} = {}) {
		this.servers = servers.filter((server) => server?.enabled !== false);
		this.createClient = createClient;
		this.clients = [];
		this.toolToClient = new Map();
		this.tools = [];
		this.enabled = false;
	}

	async connect() {
		for (const server of this.servers) {
			const client = this.createClient(server);
			const transport = new StdioClientTransport({
				command: server.command,
				args: server.args ?? [],
				env: { ...process.env, ...(server.env ?? {}) },
			});
			await client.connect(transport);
			const listed = await client.listTools();
			const tools = (listed.tools ?? []).map((tool) => ({
				name: tool.name,
				description: `[${server.name}] ${tool.description ?? tool.name}`,
				parameters: normalizeInputSchema(tool),
				namespace: "mcp",
				serverName: server.name,
				execution: "remote",
			}));
			for (const tool of tools) this.toolToClient.set(tool.name, client);
			this.tools.push(...tools);
			this.clients.push(client);
		}
		this.enabled = this.tools.length > 0;
	}

	async close() {
		await Promise.allSettled(this.clients.map((client) => client.close()));
		this.clients = [];
		this.toolToClient.clear();
		this.tools = [];
		this.enabled = false;
	}

	async callTool(name, args, { signal } = {}) {
		const client = this.toolToClient.get(name);
		if (!client) throw new Error(`Unknown MCP tool: ${name}`);
		const result = await client.callTool(
			{ name, arguments: args ?? {} },
			undefined,
			{ signal },
		);
		return normalizeToolResult(result);
	}
}
