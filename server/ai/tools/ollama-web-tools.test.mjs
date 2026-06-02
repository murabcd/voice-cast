import { describe, expect, it, vi } from "vitest";
import { OllamaWebTools } from "./ollama-web-tools.mjs";

describe("OllamaWebTools", () => {
	it("exposes strict model-facing tool schemas", () => {
		const tools = new OllamaWebTools({ apiKey: "test" });

		expect(tools.tools).toMatchObject([
			{
				name: "web_search",
				parameters: {
					required: ["query"],
					additionalProperties: false,
				},
			},
			{
				name: "web_fetch",
				parameters: {
					required: ["url"],
					additionalProperties: false,
				},
			},
		]);
		expect(tools.tools[0].parameters.properties).not.toHaveProperty(
			"max_results",
		);
	});

	it("caps search result count and snippet size for local context", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => ({
				results: Array.from({ length: 10 }, (_, index) => ({
					title: `Flone result ${index}`,
					url: `https://example.com/${index}`,
					content: "x".repeat(1000),
				})),
			}),
		}));
		vi.stubGlobal("fetch", fetchMock);

		const tools = new OllamaWebTools({
			apiKey: "test",
			maxSearchResults: 2,
			maxSearchResultContentChars: 20,
		});
		const result = await tools.callTool("web_search", {
			query: "Flone компания",
			max_results: 10,
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://ollama.com/api/web_search",
			expect.objectContaining({
				body: JSON.stringify({
					query: "Flone компания",
					max_results: 2,
				}),
			}),
		);
		expect(result.results).toHaveLength(2);
		expect(result.verified).toBe(true);
		expect(result.results[0].content.length).toBeLessThanOrEqual(123);
		vi.unstubAllGlobals();
	});

	it("marks search as unverified when results do not match the query", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					results: [
						{
							title: "Unrelated social profile",
							url: "https://example.com/profile",
							content: "A random page about another topic.",
						},
					],
				}),
			})),
		);

		const tools = new OllamaWebTools({
			apiKey: "test",
		});
		const result = await tools.callTool("web_search", {
			query: "FloomNe",
		});

		expect(result).toEqual({
			verified: false,
			reason:
				"Search results did not clearly match the requested entity or topic.",
			results: [],
		});
		vi.unstubAllGlobals();
	});

	it("matches cyrillic query names against latin result text", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					results: [
						{
							title: "Products | Flomni",
							url: "https://flomni.com/ru/products/",
							content: "Automation products for customer communication.",
						},
					],
				}),
			})),
		);

		const tools = new OllamaWebTools({
			apiKey: "test",
		});
		const result = await tools.callTool("web_search", {
			query: "Фломни",
		});

		expect(result.verified).toBe(true);
		expect(result.results).toHaveLength(1);
		vi.unstubAllGlobals();
	});

	it("caps fetched page content and links", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					title: "Example",
					content: "x".repeat(1000),
					links: Array.from({ length: 10 }, (_, index) => `/${index}`),
				}),
			})),
		);

		const tools = new OllamaWebTools({
			apiKey: "test",
			maxFetchContentChars: 40,
			maxFetchLinks: 3,
		});
		const result = await tools.callTool("web_fetch", {
			url: "https://example.com",
		});

		expect(result.content.length).toBeLessThanOrEqual(303);
		expect(result.links).toHaveLength(3);
		vi.unstubAllGlobals();
	});
});
