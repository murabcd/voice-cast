import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const root = resolve(new URL("../..", import.meta.url).pathname);

function unquoteEnvValue(value) {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function loadEnvFile(filePath) {
	if (!existsSync(filePath)) return;
	const content = readFileSync(filePath, "utf8");
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
		if (!match || process.env[match[1]] !== undefined) continue;
		process.env[match[1]] = unquoteEnvValue(match[2]);
	}
}

loadEnvFile(join(root, ".env"));
loadEnvFile(join(root, ".env.local"));

export const config = {
	root,
	port: Number(process.env.PORT ?? 8090),
	llamaUrl:
		process.env.LLAMA_URL ?? "http://127.0.0.1:18081/v1/chat/completions",
	llama: {
		maxTokens: process.env.LLAMA_MAX_TOKENS
			? Number(process.env.LLAMA_MAX_TOKENS)
			: undefined,
		temperature: Number(process.env.LLAMA_TEMPERATURE ?? 0.35),
		topP: Number(process.env.LLAMA_TOP_P ?? 0.9),
		repeatPenalty: Number(process.env.LLAMA_REPEAT_PENALTY ?? 1.05),
		toolRounds: Number(process.env.LLAMA_TOOL_ROUNDS ?? 1),
		toolDecisionMaxTokens: Number(
			process.env.LLAMA_TOOL_DECISION_MAX_TOKENS ?? 96,
		),
	},
	webTools: {
		ollamaApiKey: process.env.OLLAMA_API_KEY,
		maxSearchResults: Number(process.env.OLLAMA_WEB_MAX_SEARCH_RESULTS ?? 3),
		maxSearchResultContentChars: Number(
			process.env.OLLAMA_WEB_MAX_SEARCH_RESULT_CONTENT_CHARS ?? 360,
		),
		maxFetchContentChars: Number(
			process.env.OLLAMA_WEB_MAX_FETCH_CONTENT_CHARS ?? 1600,
		),
		maxFetchLinks: Number(process.env.OLLAMA_WEB_MAX_FETCH_LINKS ?? 5),
	},
	mcp: {
		trackerDefaultQueue: process.env.TRACKER_DEFAULT_QUEUE,
		trackerLimitQueues: process.env.TRACKER_LIMIT_QUEUES,
		servers:
			process.env.TRACKER_TOKEN &&
			(process.env.TRACKER_CLOUD_ORG_ID || process.env.TRACKER_ORG_ID)
				? [
						{
							name: "yandex-tracker",
							command: process.env.YANDEX_TRACKER_MCP_COMMAND ?? "uvx",
							args: (
								process.env.YANDEX_TRACKER_MCP_ARGS ??
								"yandex-tracker-mcp@latest"
							)
								.split(/\s+/)
								.filter(Boolean),
							env: {
								TRACKER_TOKEN: process.env.TRACKER_TOKEN,
								TRACKER_CLOUD_ORG_ID: process.env.TRACKER_CLOUD_ORG_ID,
								TRACKER_ORG_ID: process.env.TRACKER_ORG_ID,
								TRACKER_LIMIT_QUEUES: process.env.TRACKER_LIMIT_QUEUES,
								TRANSPORT: "stdio",
							},
						},
					]
				: [],
	},
	webDir: join(root, "web"),
	stt: {
		bin: join(root, "native/voice-stt-worker/target/release/voice-stt-worker"),
		modelDir: join(root, "models/parakeet-tdt-0.6b-v3-onnx-int8"),
		requiredFiles: [
			"encoder-model.int8.onnx",
			"decoder_joint-model.int8.onnx",
			"vocab.txt",
		],
	},
	tts: {
		supertonicOnnxDir: join(root, "models/supertonic-3/onnx"),
		supertonicVoiceStyle: join(
			root,
			`models/supertonic-3/voice_styles/${process.env.SUPERTONIC_VOICE ?? "M1"}.json`,
		),
		supertonicLang: process.env.SUPERTONIC_LANG ?? "ru",
		supertonicTotalStep: Number(process.env.SUPERTONIC_TOTAL_STEP ?? 5),
		supertonicSpeed: Number(process.env.SUPERTONIC_SPEED ?? 1.05),
	},
};
