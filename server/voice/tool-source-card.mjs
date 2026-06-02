function compactText(value, maxLength = 500) {
	const text = String(value ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength)}...`;
}

function collapseWhitespace(value) {
	let text = "";
	let previousWasSpace = true;
	for (const char of String(value ?? "")) {
		const isSpace = char.trim() === "";
		if (isSpace) {
			if (!previousWasSpace) text += " ";
			previousWasSpace = true;
			continue;
		}
		text += char;
		previousWasSpace = false;
	}
	return text.trim();
}

function displayText(value, maxLength = 2400) {
	const text = collapseWhitespace(
		String(value ?? "")
			.replaceAll("######", "")
			.replaceAll("#####", "")
			.replaceAll("####", "")
			.replaceAll("###", "")
			.replaceAll("##", "")
			.replaceAll("#", "")
			.replaceAll("**", "")
			.replaceAll("__", "")
			.replaceAll("*", " ")
			.replaceAll("_", " ")
			.replaceAll("`", " ")
			.replaceAll(">", " ")
			.replaceAll("~-", " ")
			.replaceAll("~", " "),
	);
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength).trim();
}

export function summarizeToolResults({ calls, results }) {
	const tools = results.map((entry) => entry.name);
	const provider = tools.some((name) => name.startsWith("web_"))
		? "web"
		: "yandex-tracker";
	const query = firstQuery(calls);
	const items = results.flatMap((entry) => resultItems(entry.result));
	const sources = dedupeSources([...callSourceItems(calls), ...items]);
	const sections = resultSections({ provider, items, results });
	const title = provider === "web" ? "Web results" : "Tracker results";
	const summary =
		items
			.slice(0, 3)
			.map((item) => [item.title, item.content].filter(Boolean).join(": "))
			.filter(Boolean)
			.join("\n\n") || "The tool returned a result, but no readable text.";
	return {
		id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		provider,
		query,
		results: items.slice(0, 8),
		sections,
		sources,
		summary,
		title,
		tools,
	};
}

function resultSections({ provider, items, results }) {
	for (const entry of results) {
		const sections = normalizeSections(entry.result?.sections);
		if (sections.length > 0) return sections;
	}
	if (provider === "web") {
		const text = items
			.slice(0, 3)
			.map((item) => item.content)
			.filter(Boolean)
			.join("\n");
		return text ? [{ label: "Key findings", text: displayText(text) }] : [];
	}
	return [];
}

function normalizeSections(value) {
	if (!Array.isArray(value)) return [];
	return value
		.map((section) => {
			const label = compactText(section?.label, 60);
			const text = displayText(section?.text);
			if (!label || !text) return undefined;
			return { label, text };
		})
		.filter(Boolean)
		.slice(0, 4);
}

function firstQuery(calls) {
	for (const call of calls ?? []) {
		const query = compactText(
			call?.arguments?.query ?? call?.arguments?.url,
			180,
		);
		if (query) return query;
	}
	return undefined;
}

function resultItems(result) {
	if (Array.isArray(result?.results)) {
		return result.results.map((item) =>
			resultItem({
				content: displayText(item?.content ?? item?.snippet),
				title: compactText(item?.title ?? item?.url ?? "Result", 140),
				url: compactText(item?.url, 240),
			}),
		);
	}
	if (Array.isArray(result?.content)) {
		return result.content.map((item) => contentItemToResult(item));
	}
	if (result?.title || result?.content) {
		return [
			resultItem({
				content: displayText(result.content),
				title: compactText(result.title ?? "Result", 140),
				url: compactText(result.url, 240),
			}),
		];
	}
	return [
		{
			content: compactText(JSON.stringify(result), 700),
			title: "Result",
		},
	];
}

function callSourceItems(calls) {
	return (calls ?? [])
		.map((call) => {
			if (call?.name !== "web_fetch") return undefined;
			const url = compactText(call?.arguments?.url, 240);
			if (!url) return undefined;
			return resultItem({
				content: "",
				title: compactText(urlHost(url) ?? url, 140),
				url,
			});
		})
		.filter(Boolean);
}

function urlHost(value) {
	try {
		return new URL(value).hostname;
	} catch {
		return undefined;
	}
}

function contentItemToResult(item) {
	if (item?.type === "resource") {
		return resultItem({
			content: displayText(item.resource?.text),
			title: compactText(item.resource?.uri ?? "Resource", 140),
			url: compactText(item.resource?.uri, 240),
		});
	}
	return {
		content: displayText(item?.text ?? JSON.stringify(item)),
		title: "Result",
	};
}

function resultItem({ content, title, url }) {
	return url ? { content, title, url } : { content, title };
}

function dedupeSources(items) {
	const seen = new Set();
	const sources = [];
	for (const item of items) {
		const title = compactText(item.title, 140);
		const url = compactText(item.url, 240);
		const key = `${title}:${url}`;
		if (!title || seen.has(key)) continue;
		seen.add(key);
		sources.push(url ? { title, url } : { title });
	}
	return sources.slice(0, 8);
}
