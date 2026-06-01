import { buildVoiceMessages } from "../ai/prompts.mjs";
import { stripLlmArtifacts } from "./text.mjs";

const textDecoder = new TextDecoder();

function normalizeToolForTemplate(tool) {
	if (tool?.type === "function") return tool;
	return {
		type: "function",
		function: {
			name: tool.name,
			description: tool.description ?? tool.name,
			parameters: tool.parameters ?? {
				type: "object",
				properties: {},
			},
		},
	};
}

function buildRequestBody({
	messages,
	maxTokens,
	temperature,
	topP,
	repeatPenalty,
	tools,
}) {
	const chatTemplateKwargs = { enable_thinking: false };
	if (tools?.length)
		chatTemplateKwargs.tools = tools.map((tool) =>
			normalizeToolForTemplate(tool),
		);
	const body = {
		model: "local",
		temperature,
		top_p: topP,
		repeat_penalty: repeatPenalty,
		chat_template_kwargs: chatTemplateKwargs,
		messages,
	};
	if (Number.isInteger(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;
	return body;
}

async function fetchLlama({
	url,
	signal,
	messages,
	maxTokens,
	temperature,
	topP,
	repeatPenalty,
	tools,
	stream,
}) {
	const body = buildRequestBody({
		messages,
		maxTokens,
		temperature,
		topP,
		repeatPenalty,
		tools,
	});
	body.stream = stream;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		signal,
		body: JSON.stringify(body),
	});
	if (!response.ok || !response.body)
		throw new Error(`llama.cpp HTTP ${response.status}`);
	return response;
}

export async function completeLlamaReply({
	url,
	history,
	prompt,
	signal,
	systemPrompt,
	messages = buildVoiceMessages({ prompt, systemPrompt, history }),
	maxTokens,
	temperature = 0.35,
	topP = 0.9,
	repeatPenalty = 1.05,
	tools,
}) {
	const response = await fetchLlama({
		url,
		signal,
		messages,
		maxTokens,
		temperature,
		topP,
		repeatPenalty,
		tools,
		stream: false,
	});
	const payload = await response.json();
	return payload.choices?.[0]?.message?.content ?? "";
}

export async function* streamLlamaReply({
	url,
	history,
	prompt,
	signal,
	systemPrompt,
	messages = buildVoiceMessages({ prompt, systemPrompt, history }),
	maxTokens,
	temperature = 0.35,
	topP = 0.9,
	repeatPenalty = 1.05,
	tools,
}) {
	const response = await fetchLlama({
		url,
		signal,
		messages,
		maxTokens,
		temperature,
		topP,
		repeatPenalty,
		tools,
		stream: true,
	});
	const reader = response.body.getReader();
	let buffer = "";
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += textDecoder.decode(value, { stream: true });
		while (true) {
			const newline = buffer.indexOf("\n");
			if (newline < 0) break;
			const line = buffer.slice(0, newline).trim();
			buffer = buffer.slice(newline + 1);
			if (!line.startsWith("data:")) continue;
			const data = line.slice(5).trim();
			if (data === "[DONE]") return;
			const payload = JSON.parse(data);
			const delta = stripLlmArtifacts(
				payload.choices?.[0]?.delta?.content ?? "",
			);
			if (delta.length > 0) yield delta;
		}
	}
}
