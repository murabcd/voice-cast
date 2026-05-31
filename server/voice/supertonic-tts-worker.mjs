import { dirname, join } from "node:path";
import {
	loadTextToSpeech,
	loadVoiceStyle,
} from "../../vendor/supertonic/nodejs/helper.js";
import { requireFile } from "./assertions.mjs";
import { log } from "./logger.mjs";

const pcmChunkBytes = 4096;

export const supertonicLanguages = new Set([
	"en",
	"ko",
	"ja",
	"ar",
	"bg",
	"cs",
	"da",
	"de",
	"el",
	"es",
	"et",
	"fi",
	"fr",
	"hi",
	"hr",
	"hu",
	"id",
	"it",
	"lt",
	"lv",
	"nl",
	"pl",
	"pt",
	"ro",
	"ru",
	"sk",
	"sl",
	"sv",
	"tr",
	"uk",
	"vi",
]);

export const supertonicVoiceNames = new Set([
	"F1",
	"F2",
	"F3",
	"F4",
	"F5",
	"M1",
	"M2",
	"M3",
	"M4",
	"M5",
]);

function floatWavToPcm16(wav) {
	const pcm = Buffer.allocUnsafe(wav.length * 2);
	for (let i = 0; i < wav.length; i += 1) {
		const sample = Math.max(-1, Math.min(1, wav[i]));
		pcm.writeInt16LE(Math.round(sample * 32767), i * 2);
	}
	return pcm;
}

export class SupertonicTtsWorker {
	constructor({
		supertonicOnnxDir,
		supertonicVoiceStyle,
		supertonicLang,
		supertonicTotalStep,
		supertonicSpeed,
	}) {
		requireFile(
			join(supertonicOnnxDir, "duration_predictor.onnx"),
			"Supertonic duration predictor is missing",
		);
		requireFile(
			join(supertonicOnnxDir, "text_encoder.onnx"),
			"Supertonic text encoder is missing",
		);
		requireFile(
			join(supertonicOnnxDir, "vector_estimator.onnx"),
			"Supertonic vector estimator is missing",
		);
		requireFile(
			join(supertonicOnnxDir, "vocoder.onnx"),
			"Supertonic vocoder is missing",
		);
		requireFile(
			join(supertonicOnnxDir, "tts.json"),
			"Supertonic config is missing",
		);
		requireFile(
			join(supertonicOnnxDir, "unicode_indexer.json"),
			"Supertonic unicode indexer is missing",
		);
		requireFile(supertonicVoiceStyle, "Supertonic voice style is missing");

		this.lang = supertonicLang;
		this.voiceStyleDir = dirname(supertonicVoiceStyle);
		this.defaultVoiceName =
			supertonicVoiceStyle.match(/([FM][1-5])\.json$/)?.[1] ?? "M1";
		this.voiceStyles = new Map();
		this.totalStep = supertonicTotalStep;
		this.speed = supertonicSpeed;
		this.nextId = 1;
		this.pending = new Map();
		this.queue = Promise.resolve();
		this.closed = false;

		this.ready = (async () => {
			const started = Date.now();
			this.tts = await loadTextToSpeech(supertonicOnnxDir, false);
			this.style = this.loadStyle(this.defaultVoiceName);
			this.sampleRate = this.tts.sampleRate;
			log(
				"tts",
				`supertonic ready sampleRate=${this.sampleRate} voice=${supertonicVoiceStyle} elapsed_ms=${Date.now() - started}`,
			);
		})();
	}

	loadStyle(voiceName) {
		const normalized = supertonicVoiceNames.has(voiceName)
			? voiceName
			: this.defaultVoiceName;
		const cached = this.voiceStyles.get(normalized);
		if (cached) return cached;
		const stylePath = join(this.voiceStyleDir, `${normalized}.json`);
		requireFile(stylePath, `Supertonic voice style ${normalized} is missing`);
		const style = loadVoiceStyle([stylePath]);
		this.voiceStyles.set(normalized, style);
		return style;
	}

	speak(text, callbacks) {
		if (this.closed) throw new Error("Supertonic TTS worker is not available");
		if (!this.tts || !this.style)
			throw new Error("Supertonic TTS worker is not ready");

		const clean = String(text ?? "").trim();
		if (!clean) throw new Error("Supertonic TTS received empty text");

		const id = this.nextId++;
		const started = Date.now();
		const request = { cancelled: false };
		const lang = supertonicLanguages.has(callbacks.lang)
			? callbacks.lang
			: this.lang;
		const style = this.loadStyle(callbacks.voiceName);
		this.pending.set(id, request);

		this.queue = this.queue
			.then(async () => {
				try {
					if (request.cancelled || !this.pending.has(id)) return;
					const { wav } = await this.tts.call(
						clean,
						lang,
						style,
						this.totalStep,
						this.speed,
						0.08,
					);
					const current = this.pending.get(id);
					if (!current || current.cancelled) return;
					const generatedAt = Date.now();
					callbacks.onStart(this.sampleRate);
					log(
						"tts",
						`supertonic generated_buffer id=${id} generation_ms=${generatedAt - started} samples=${wav.length}`,
					);
					const pcm = floatWavToPcm16(wav);
					let chunks = 0;
					for (
						let offset = 0;
						offset < pcm.byteLength;
						offset += pcmChunkBytes
					) {
						if (!this.pending.has(id) || request.cancelled) return;
						callbacks.onAudio(pcm.subarray(offset, offset + pcmChunkBytes));
						chunks += 1;
					}
					this.pending.delete(id);
					log(
						"tts",
						`supertonic audio_sent id=${id} elapsed_ms=${Date.now() - started} chunks=${chunks} bytes=${pcm.byteLength}`,
					);
					callbacks.onDone();
				} catch (error) {
					if (!this.pending.has(id)) return;
					this.pending.delete(id);
					callbacks.onError(
						error instanceof Error
							? `Supertonic failed: ${error.message}`
							: `Supertonic failed: ${String(error)}`,
					);
				}
			})
			.catch((error) => {
				log(
					"tts",
					`supertonic queue error: ${error instanceof Error ? error.message : String(error)}`,
				);
			});

		return id;
	}

	cancel(reason = "cancel") {
		if (this.closed || this.pending.size === 0) return;
		const ids = [...this.pending.keys()];
		log("tts", `supertonic cancel ids=${ids.join(",")} reason=${reason}`);
		for (const request of this.pending.values()) request.cancelled = true;
		this.pending.clear();
	}

	shutdown() {
		this.closed = true;
		this.cancel("shutdown");
	}
}
