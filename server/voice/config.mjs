import { join, resolve } from "node:path";

export const root = resolve(new URL("../..", import.meta.url).pathname);

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
	},
	logDir: join(root, "logs"),
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
