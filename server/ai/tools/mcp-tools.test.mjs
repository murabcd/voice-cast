import { describe, expect, it } from "vitest";
import { McpTools } from "./mcp-tools.mjs";

describe("MCP tools", () => {
	it("preserves full text payloads for adapter-owned parsing", async () => {
		const longText = JSON.stringify({
			key: "PROJ-4911",
			padding: "x".repeat(4000),
			summary: "Оценить доработку аналитики или диалогов",
		});
		const mcpTools = new McpTools({
			servers: [{ name: "tracker", command: "unused" }],
			createClient: () => ({
				close: async () => {},
				connect: async () => {},
				listTools: async () => ({
					tools: [
						{
							name: "issue_get",
							description: "get issue",
							inputSchema: { type: "object", properties: {} },
						},
					],
				}),
				callTool: async () => ({
					content: [{ type: "text", text: longText }],
				}),
			}),
		});

		await mcpTools.connect();

		const result = await mcpTools.callTool("issue_get", {});

		expect(result.content).toEqual([{ type: "text", text: longText }]);
	});

	it("preserves structured MCP content for adapter-owned parsing", async () => {
		const structuredContent = {
			key: "PROJ-4911",
			summary: "Оценить доработку аналитики или диалогов",
		};
		const mcpTools = new McpTools({
			servers: [{ name: "tracker", command: "unused" }],
			createClient: () => ({
				close: async () => {},
				connect: async () => {},
				listTools: async () => ({
					tools: [{ name: "issue_get", inputSchema: {} }],
				}),
				callTool: async () => ({
					content: [],
					structuredContent,
				}),
			}),
		});

		await mcpTools.connect();

		const result = await mcpTools.callTool("issue_get", {});

		expect(result.structuredContent).toEqual(structuredContent);
	});
});
