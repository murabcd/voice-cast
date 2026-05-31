import { buildVoiceMessages } from "./assistant-policy.mjs";
import { stripLlmArtifacts } from "./text.mjs";

const textDecoder = new TextDecoder();

export async function* streamLlamaReply({
	url,
	prompt,
	signal,
	systemPrompt,
	maxTokens,
	temperature = 0.35,
	topP = 0.9,
	repeatPenalty = 1.05,
}) {
	const body = {
		model: "local",
		stream: true,
		temperature,
		top_p: topP,
		repeat_penalty: repeatPenalty,
		chat_template_kwargs: { enable_thinking: false },
		messages: buildVoiceMessages({ prompt, systemPrompt }),
	};
	if (Number.isInteger(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		signal,
		body: JSON.stringify(body),
	});
	if (!response.ok || !response.body)
		throw new Error(`llama.cpp HTTP ${response.status}`);

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
