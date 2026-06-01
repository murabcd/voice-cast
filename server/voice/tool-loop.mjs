import { buildVoiceMessages } from "../ai/prompts.mjs";
import { completeLlamaReply } from "./llama.mjs";
import { log } from "./logger.mjs";

const toolCallPattern = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
const webToolInstructions = [
	"Доступны только перечисленные веб-инструменты. Не выдумывай, не переименовывай и не симулируй инструменты.",
	"Веб-инструменты read-only. Не спрашивай подтверждение перед очевидным read-only поиском, если запрос понятен.",
	"Вызови инструмент только если вопрос требует свежей, внешней, проверяемой информации или пользователь явно просит проверить онлайн.",
	"Не вызывай инструменты для обычного разговора, вечных фактов, персонажного стиля или неясной речи.",
	'Вызов инструмента должен быть ровно в формате <tool_call>{"name":"tool_name","arguments":{...}}</tool_call>.',
].join("\n");

const webToolResultInstructions = [
	"Если require_grounded_answer=true, отвечай только на основе results.",
	"Если verified=false, results пустые или нужного факта нет в results, скажи, что не удалось надежно проверить, и не угадывай.",
	"Это голосовой ответ: кратко перескажи человеческими словами, не выводи ссылки, URL, Markdown, XML, JSON, скобки с адресами сайтов или технические имена инструментов.",
].join("\n");

export function parseToolCalls(text) {
	return [...text.matchAll(toolCallPattern)].map((match) => {
		const payload = JSON.parse(match[1]);
		return {
			name: payload.name,
			arguments: payload.arguments ?? {},
		};
	});
}

export function toolResultMessage(results) {
	const payload = {
		type: "web_tool_results",
		require_grounded_answer: true,
		speech_response: true,
		results,
	};
	return [
		"Ниже JSON с проверенными результатами веб-инструментов.",
		JSON.stringify(payload),
		webToolResultInstructions,
	].join("\n");
}

function compactDirectWebSearchResult(result) {
	const rawResults = Array.isArray(result?.results) ? result.results : [];
	return {
		verified: result?.verified === true,
		reason: compactText(result?.reason, 180),
		results: rawResults.slice(0, 3).map((item) => ({
			title: compactText(item?.title, 120),
			content: compactText(item?.content ?? item?.snippet, 280),
		})),
	};
}

export async function prepareDirectWebSearchMessages({
	history,
	prompt,
	systemPrompt,
	signal,
	toolManager,
	onToolActivity,
}) {
	const compactHistory = Array.isArray(history) ? history.slice(-2) : history;
	const messages = buildVoiceMessages({
		prompt,
		systemPrompt,
		history: compactHistory,
	});
	if (!toolManager?.enabled) return messages;
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
		messages.push({
			role: "user",
			content: toolResultMessage([
				{ name: "web_search", result: compactResult },
			]),
		});
		messages.push({
			role: "user",
			content:
				"Сформулируй финальный голосовой ответ только на основе результатов поиска. Если verified=false или результатов нет, скажи, что не удалось надежно проверить. Не говори, что у тебя нет доступа к интернету.",
		});
		return messages;
	} finally {
		onToolActivity?.({ active: false, name: "web_search" });
	}
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
		`- ${tool.name}: ${tool.description ?? "available tool"}`,
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
				name: call.name,
				result,
			});
		} finally {
			onToolActivity?.({ active: false, name: call.name });
		}
	}
	return results;
}

export async function prepareToolAugmentedMessages({
	llamaUrl,
	history,
	prompt,
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
}) {
	const messages = buildVoiceMessages({ prompt, systemPrompt, history });
	const baseMessages = [...messages];
	if (!toolManager?.tools?.length || rounds <= 0) return messages;
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
			tools: toolManager.tools,
		});
		const calls = parseToolCalls(reply);
		if (calls.length === 0) {
			log("tool", `round_none round=${round + 1}`);
			onToolActivity?.({ active: false });
			break;
		}
		usedTool = true;
		const results = await callTools({
			calls,
			toolManager,
			onToolActivity,
			round: round + 1,
			signal,
		});
		messages.push({ role: "assistant", content: reply });
		messages.push({ role: "user", content: toolResultMessage(results) });
	}

	if (!usedTool) return baseMessages;
	messages.push({
		role: "user",
		content:
			"Сформулируй финальный голосовой ответ только на основе уже полученных результатов. Не вызывай новые инструменты и не угадывай факты, которых нет в результатах. Не произноси URL, Markdown-ссылки, JSON, XML или технические имена источников; просто кратко перескажи найденное.",
	});
	return messages;
}
