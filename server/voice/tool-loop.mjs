import { buildVoiceMessages } from "../ai/prompts.mjs";
import { completeLlamaReply } from "./llama.mjs";
import { log } from "./logger.mjs";
import { summarizeToolResults } from "./tool-source-card.mjs";

const toolCallPattern = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
const webToolInstructions = [
	"Доступны только перечисленные инструменты. Не выдумывай, не переименовывай и не симулируй инструменты.",
	"Не спрашивай подтверждение перед очевидным read-only запросом, если запрос понятен.",
	"Вызови инструмент только если вопрос требует внешней системы, свежей проверяемой информации или пользователь явно просит проверить онлайн.",
	"Не вызывай инструменты для обычного разговора, вечных фактов, персонажного стиля или неясной речи.",
	'Вызов инструмента должен быть ровно в формате <tool_call>{"name":"tool_name","arguments":{...}}</tool_call>.',
].join("\n");

const webToolResultInstructions = [
	"Если require_grounded_answer=true, отвечай только на основе results.",
	"Если verified=false, results пустые или нужного факта нет в results, скажи, что не удалось надежно проверить, и не угадывай.",
	"Это голосовой ответ: кратко перескажи человеческими словами, не выводи ссылки, URL, Markdown, XML, JSON, скобки с адресами сайтов или технические имена инструментов.",
].join("\n");

export function parseToolCalls(text) {
	const calls = [];
	for (const match of text.matchAll(toolCallPattern)) {
		let payload;
		try {
			payload = JSON.parse(match[1]);
		} catch (error) {
			log(
				"tool",
				`parse_failed error=${JSON.stringify(error instanceof Error ? error.message : String(error))}`,
			);
			continue;
		}
		if (!payload?.name) continue;
		calls.push({
			name: payload.name,
			arguments: payload.arguments ?? {},
		});
	}
	return calls;
}

function dedupeToolCalls(calls) {
	const seen = new Set();
	return calls.filter((call) => {
		const key = `${call.name}\0${stableJson(call.arguments)}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function stableJson(value) {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function appendDirectWebSearchResultMessage(messages, compactResult) {
	messages.push({
		role: "user",
		content: toolResultMessage([{ name: "web_search", result: compactResult }]),
	});
}

async function callDirectWebSearch({
	prompt,
	signal,
	toolManager,
	onToolActivity,
	onToolResult,
}) {
	onToolActivity?.({ active: true, name: "web_search" });
	try {
		const result = await toolManager.callTool(
			"web_search",
			{ query: prompt },
			{ signal },
		);
		const compactResult = compactDirectWebSearchResult(result);
		log(
			"tool",
			`direct_search name=web_search chars=${JSON.stringify(result).length} compact_chars=${JSON.stringify(compactResult).length} preview=${JSON.stringify(compactText(JSON.stringify(compactResult)))}`,
		);
		const toolResultSummary = summarizeToolResults({
			calls: [{ name: "web_search", arguments: { query: prompt } }],
			results: [{ name: "web_search", result }],
		});
		if (toolResultSummary) {
			onToolResult?.({
				type: "tool_result",
				...toolResultSummary,
			});
		}
		return compactResult;
	} finally {
		onToolActivity?.({ active: false, name: "web_search" });
	}
}

export function toolResultMessage(results) {
	const payload = {
		type: "tool_results",
		require_grounded_answer: true,
		speech_response: true,
		results: results.map(compactToolResultForModel),
	};
	return [
		"Ниже JSON с проверенными результатами инструментов.",
		JSON.stringify(payload),
		webToolResultInstructions,
	].join("\n");
}

function compactToolResultForModel(entry) {
	return {
		arguments: entry.arguments,
		name: entry.name,
		result: compactToolPayloadForModel(entry.result),
		status: toolResultStatus(entry.result),
	};
}

function toolResultStatus(result) {
	const errorCode = compactText(result?.error?.code, 80);
	if (errorCode) return { kind: "error", code: errorCode };
	if (hasReadableToolPayload(result)) return { kind: "found" };
	return { kind: "empty" };
}

function hasReadableToolPayload(result) {
	if (!result || typeof result !== "object") return false;
	if (compactText(result.title) || compactText(result.content)) return true;
	return (
		compactSectionsForModel(result.sections).length > 0 ||
		compactResultItemsForModel(result.results).length > 0 ||
		compactSourcesForModel(result.sources).length > 0
	);
}

function compactToolPayloadForModel(result) {
	if (result?.error) return { error: result.error };
	const payload = {};
	if (typeof result?.verified === "boolean") payload.verified = result.verified;
	const reason = compactText(result?.reason, 180);
	if (reason) payload.reason = reason;
	const title = compactText(result?.title, 120);
	if (title) payload.title = title;
	const content = compactText(result?.content, 720);
	if (content) payload.content = content;
	const sections = compactSectionsForModel(result?.sections);
	if (sections.length > 0) payload.sections = sections;
	const results = compactResultItemsForModel(result?.results);
	if (results.length > 0) payload.results = results;
	const sources = compactSourcesForModel(result?.sources);
	if (sources.length > 0) payload.sources = sources;
	return payload;
}

function compactSectionsForModel(value) {
	if (!Array.isArray(value)) return [];
	return value
		.map((section) => {
			const label = compactText(section?.label, 60);
			const text = compactText(section?.text, label === "Context" ? 260 : 360);
			if (!label || !text) return undefined;
			return { label, text };
		})
		.filter(Boolean)
		.slice(0, 4);
}

function compactResultItemsForModel(value) {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			const title = compactText(item?.title, 120);
			const content = compactText(item?.content, 520);
			if (!title && !content) return undefined;
			return {
				...(title ? { title } : {}),
				...(content ? { content } : {}),
			};
		})
		.filter(Boolean)
		.slice(0, 4);
}

function compactSourcesForModel(value) {
	if (!Array.isArray(value)) return [];
	return value
		.map((source) => compactText(source?.title, 120))
		.filter(Boolean)
		.slice(0, 4);
}

function compactDirectWebSearchResult(result) {
	const rawResults = Array.isArray(result?.results) ? result.results : [];
	return {
		verified: result?.verified === true,
		reason: compactText(result?.reason, 180),
		results: rawResults.slice(0, 3).map((item) => {
			const url = compactText(item?.url, 240);
			return {
				title: compactText(item?.title, 120),
				content: compactText(item?.content ?? item?.snippet, 280),
				...(url ? { url } : {}),
			};
		}),
	};
}

export async function prepareDirectWebSearchMessages({
	history,
	prompt,
	searchQuery,
	systemPrompt,
	runtimeContext,
	signal,
	toolManager,
	onToolActivity,
	onToolResult,
}) {
	const compactHistory = Array.isArray(history) ? history.slice(-2) : history;
	const messages = buildVoiceMessages({
		prompt,
		runtimeContext,
		systemPrompt,
		history: compactHistory,
	});
	if (!toolManager?.enabled)
		throw new Error("Selected web search is disabled.");
	const compactResult = await callDirectWebSearch({
		prompt: searchQuery ?? prompt,
		signal,
		toolManager,
		onToolActivity,
		onToolResult,
	});
	appendDirectWebSearchResultMessage(messages, compactResult);
	messages.push({
		role: "user",
		content:
			"Сформулируй финальный голосовой ответ только на основе результатов поиска. Если verified=false или результатов нет, скажи, что не удалось надежно проверить. Не говори, что у тебя нет доступа к интернету.",
	});
	return messages;
}

export async function prepareDirectWebFetchMessages({
	history,
	prompt,
	systemPrompt,
	runtimeContext,
	signal,
	toolManager,
	toolArguments,
	onToolActivity,
	onToolResult,
}) {
	return await prepareSingleToolMessages({
		finalInstruction:
			"Сформулируй финальный голосовой ответ только на основе содержимого страницы. Если на странице нет цены, тарифа или стоимости, прямо скажи, что на указанной странице точную цену не удалось найти. Не подменяй ответ общими результатами поиска и не угадывай.",
		history,
		prompt,
		runtimeContext,
		signal,
		systemPrompt,
		toolArguments,
		toolManager,
		toolName: "web_fetch",
		onToolActivity,
		onToolResult,
	});
}

export async function prepareDirectToolResultMessages({
	history,
	prompt,
	systemPrompt,
	runtimeContext,
	signal,
	toolManager,
	toolName,
	toolArguments,
	onToolActivity,
	onToolResult,
}) {
	return await prepareSingleToolMessages({
		finalInstruction:
			"Сформулируй финальный голосовой ответ только на основе результата инструмента. Используй results[].status как источник статуса: status.kind=found значит инструмент нашел результат; status.kind=empty значит надежного результата нет; status.kind=error с code=unauthorized или code=forbidden значит Яндекс Трекер отклонил запрос из-за доступа или авторизации. Для Tracker кратко суммируй About, Context и Latest decision в одном-двух предложениях, не читая Context дословно. Не произноси JSON, XML, URL или технические имена инструментов.",
		history,
		prompt,
		runtimeContext,
		signal,
		systemPrompt,
		toolArguments,
		toolManager,
		toolName,
		onToolActivity,
		onToolResult,
	});
}

async function prepareSingleToolMessages({
	finalInstruction,
	history,
	prompt,
	systemPrompt,
	runtimeContext,
	signal,
	toolManager,
	toolName,
	toolArguments,
	onToolActivity,
	onToolResult,
}) {
	const messages = buildVoiceMessages({
		prompt,
		runtimeContext,
		systemPrompt,
		history: Array.isArray(history) ? history.slice(-2) : history,
	});
	const results = await callTools({
		calls: [{ name: toolName, arguments: toolArguments ?? {} }],
		toolManager,
		onToolActivity,
		onToolResult,
		round: 1,
		signal,
	});
	messages.push({
		role: "user",
		content: toolResultMessage(results),
	});
	messages.push({
		role: "user",
		content: finalInstruction,
	});
	return messages;
}

function compactText(value, maxLength = 500) {
	const text = String(value ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength)}...`;
}

function describeTool(tool) {
	const properties = Object.keys(getSchemaProperties(tool));
	return [
		`- ${tool.name}: ${compactText(tool.description ?? "available tool", 220)}`,
		properties.length ? `Input fields: ${properties.join(", ")}.` : "",
	]
		.filter(Boolean)
		.join(" ");
}

function toolPrimerMessage(tools) {
	return [
		webToolInstructions,
		"Доступные инструменты:",
		...tools.map(describeTool),
		"Если ни один инструмент не подходит, ответь ровно: NO_TOOL",
	].join("\n");
}

function getSchemaProperties(tool) {
	const parameters = tool?.parameters;
	if (!parameters || typeof parameters !== "object") return {};
	const properties = parameters.properties;
	return properties && typeof properties === "object" ? properties : {};
}

async function callTools({
	calls,
	toolManager,
	onToolActivity,
	onToolResult,
	round,
	signal,
}) {
	const results = [];
	for (const call of calls) {
		log(
			"tool",
			`call round=${round} name=${call.name} args=${compactText(JSON.stringify(call.arguments), 300)}`,
		);
		onToolActivity?.({ active: true, name: call.name });
		try {
			const result = await toolManager.callTool(call.name, call.arguments, {
				signal,
			});
			log(
				"tool",
				`result round=${round} name=${call.name} chars=${JSON.stringify(result).length} preview=${JSON.stringify(compactText(JSON.stringify(result)))}`,
			);
			results.push({
				arguments: call.arguments,
				name: call.name,
				result,
			});
		} finally {
			onToolActivity?.({ active: false, name: call.name });
		}
	}
	if (results.length > 0) {
		const toolResultSummary = summarizeToolResults({ calls, results });
		if (toolResultSummary) {
			onToolResult?.({
				type: "tool_result",
				...toolResultSummary,
			});
		}
	}
	return results;
}

export async function prepareToolAugmentedMessages({
	llamaUrl,
	history,
	prompt,
	runtimeContext,
	systemPrompt,
	signal,
	toolManager,
	maxTokens,
	temperature,
	topP,
	repeatPenalty,
	rounds,
	decisionMaxTokens,
	onToolActivity,
	onToolResult,
}) {
	const messages = buildVoiceMessages({
		prompt,
		runtimeContext,
		systemPrompt,
		history,
	});
	const baseMessages = [...messages];
	if (!toolManager?.tools?.length)
		throw new Error("Selected tool route has no available tools.");
	if (!toolManager.enabled) throw new Error("Selected tool route is disabled.");
	if (rounds <= 0) {
		baseMessages.push({
			role: "user",
			content:
				"Подходящий инструмент не был вызван. Кратко скажи, что не удалось выполнить запрос через доступные инструменты, и не угадывай результат.",
		});
		return baseMessages;
	}
	messages.push({
		role: "user",
		content: toolPrimerMessage(toolManager.tools),
	});

	let usedTool = false;
	for (let round = 0; round < rounds; round += 1) {
		log(
			"tool",
			`round_start round=${round + 1} tools=${toolManager.tools.length}`,
		);
		const reply = await completeLlamaReply({
			url: llamaUrl,
			signal,
			messages,
			maxTokens: decisionMaxTokens ?? Math.min(maxTokens ?? 96, 96),
			temperature,
			topP,
			repeatPenalty,
			purpose: "tool_decision",
		});
		const calls = parseToolCalls(reply);
		if (calls.length === 0) {
			log("tool", `round_none round=${round + 1}`);
			onToolActivity?.({ active: false });
			break;
		}
		const uniqueCalls = dedupeToolCalls(calls);
		if (uniqueCalls.length !== calls.length) {
			log(
				"tool",
				`dedupe round=${round + 1} requested=${calls.length} unique=${uniqueCalls.length}`,
			);
		}
		usedTool = true;
		const results = await callTools({
			calls: uniqueCalls,
			toolManager,
			onToolActivity,
			round: round + 1,
			signal,
			onToolResult,
		});
		messages.push({ role: "assistant", content: reply });
		messages.push({ role: "user", content: toolResultMessage(results) });
	}

	if (!usedTool) {
		baseMessages.push({
			role: "user",
			content:
				"Подходящий инструмент не был вызван. Кратко скажи, что не удалось выполнить запрос через доступные инструменты, и не угадывай результат.",
		});
		return baseMessages;
	}
	messages.push({
		role: "user",
		content:
			"Сформулируй финальный голосовой ответ только на основе уже полученных результатов. Не вызывай новые инструменты и не угадывай факты, которых нет в результатах. Не произноси URL, Markdown-ссылки, JSON, XML или технические имена источников; просто кратко перескажи найденное.",
	});
	return messages;
}
