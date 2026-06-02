const ollamaApiUrl = "https://ollama.com/api";
const cyrillicToLatin = new Map(
	Object.entries({
		а: "a",
		б: "b",
		в: "v",
		г: "g",
		д: "d",
		е: "e",
		ё: "e",
		ж: "zh",
		з: "z",
		и: "i",
		й: "i",
		к: "k",
		л: "l",
		м: "m",
		н: "n",
		о: "o",
		п: "p",
		р: "r",
		с: "s",
		т: "t",
		у: "u",
		ф: "f",
		х: "h",
		ц: "ts",
		ч: "ch",
		ш: "sh",
		щ: "sch",
		ы: "y",
		э: "e",
		ю: "yu",
		я: "ya",
	}),
);

function truncateText(value, maxLength) {
	const text = String(value ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength).trim();
}

function normalizeSearchResult(result, maxContentChars) {
	return {
		title: truncateText(result?.title, 180),
		url: String(result?.url ?? "").trim(),
		content: truncateText(result?.content, maxContentChars),
	};
}

function normalizeComparableText(value) {
	return String(value ?? "")
		.toLowerCase()
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "");
}

function transliterateCyrillic(value) {
	return [...normalizeComparableText(value)]
		.map((char) => cyrillicToLatin.get(char) ?? char)
		.join("");
}

function queryTokens(query) {
	const normalized = normalizeComparableText(query);
	const transliterated = transliterateCyrillic(query);
	return [
		...new Set(
			[normalized, transliterated].join(" ").match(/[a-zа-я0-9]{3,}/gi) ?? [],
		),
	];
}

function resultContainsQuery(result, tokens) {
	if (tokens.length === 0) return true;
	const haystack = normalizeComparableText(
		`${result.title} ${result.url} ${result.content}`,
	);
	const transliteratedHaystack = transliterateCyrillic(haystack);
	return tokens.some(
		(token) =>
			haystack.includes(token) || transliteratedHaystack.includes(token),
	);
}

function normalizeFetchResult(result, { maxContentChars, maxLinks }) {
	return {
		title: truncateText(result?.title, 180),
		content: truncateText(result?.content, maxContentChars),
		links: Array.isArray(result?.links) ? result.links.slice(0, maxLinks) : [],
	};
}

export class OllamaWebTools {
	constructor({
		apiKey,
		maxSearchResults = 3,
		maxSearchResultContentChars = 1200,
		maxFetchContentChars = 1600,
		maxFetchLinks = 5,
	}) {
		this.apiKey = apiKey;
		this.maxSearchResults = Math.max(1, Math.min(10, maxSearchResults));
		this.maxSearchResultContentChars = Math.max(
			120,
			maxSearchResultContentChars,
		);
		this.maxFetchContentChars = Math.max(300, maxFetchContentChars);
		this.maxFetchLinks = Math.max(0, Math.min(10, maxFetchLinks));
		this.tools = apiKey
			? [
					{
						name: "web_search",
						description:
							"Read-only web lookup. Use when the user explicitly asks to search/check online, asks for current/latest/recent information, or asks about a public website/documentation/source that may have changed after model training. Do not use for normal conversation, timeless facts, character chat, or questions answerable from existing context. Returns a small JSON object with verified, reason, and results.",
						parameters: {
							type: "object",
							properties: {
								query: {
									type: "string",
									description: "The concise web search query.",
								},
							},
							required: ["query"],
							additionalProperties: false,
						},
					},
					{
						name: "web_fetch",
						description:
							"Read-only page fetch. Use only for a public URL returned by web_search or explicitly provided by the user when snippets are not enough. Do not invent URLs. Returns a small JSON object with title, content, and links.",
						parameters: {
							type: "object",
							properties: {
								url: {
									type: "string",
									description: "The public URL to fetch and read.",
								},
							},
							required: ["url"],
							additionalProperties: false,
						},
					},
				]
			: [];
	}

	get enabled() {
		return this.tools.length > 0;
	}

	async callTool(name, args, { signal } = {}) {
		if (name === "web_search") return await this.#search(args, signal);
		if (name === "web_fetch") return await this.#fetch(args, signal);
		throw new Error(`Unknown Ollama web tool: ${name}`);
	}

	async #post(path, body, signal) {
		if (!this.apiKey) throw new Error("OLLAMA_API_KEY is not configured.");
		const response = await fetch(`${ollamaApiUrl}${path}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
			},
			signal,
			body: JSON.stringify(body),
		});
		if (!response.ok)
			throw new Error(
				`Ollama web API ${response.status}: ${await response.text()}`,
			);
		return await response.json();
	}

	async #search(args, signal) {
		const query = String(args?.query ?? "").trim();
		if (!query) throw new Error("web_search requires a query.");
		const maxResults = Number(args?.max_results ?? 3);
		const resultLimit = Number.isInteger(maxResults)
			? Math.max(1, Math.min(this.maxSearchResults, maxResults))
			: this.maxSearchResults;
		const payload = await this.#post(
			"/web_search",
			{
				query,
				max_results: resultLimit,
			},
			signal,
		);
		const normalizedResults = Array.isArray(payload?.results)
			? payload.results
					.slice(0, resultLimit)
					.map((result) =>
						normalizeSearchResult(result, this.maxSearchResultContentChars),
					)
			: [];
		const tokens = queryTokens(query);
		const relevantResults = normalizedResults.filter((result) =>
			resultContainsQuery(result, tokens),
		);
		if (relevantResults.length === 0) {
			return {
				verified: false,
				reason:
					"Search results did not clearly match the requested entity or topic.",
				results: [],
			};
		}
		return {
			verified: true,
			results: relevantResults,
		};
	}

	async #fetch(args, signal) {
		const url = String(args?.url ?? "").trim();
		if (!url) throw new Error("web_fetch requires a url.");
		return normalizeFetchResult(
			await this.#post("/web_fetch", { url }, signal),
			{
				maxContentChars: this.maxFetchContentChars,
				maxLinks: this.maxFetchLinks,
			},
		);
	}
}
