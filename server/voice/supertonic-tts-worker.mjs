import { join } from "node:path";
import {
	loadTextToSpeech,
	loadVoiceStyle,
} from "../../vendor/supertonic/nodejs/helper.js";
import { requireFile } from "./assertions.mjs";
import { log } from "./logger.mjs";

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
		this.totalStep = supertonicTotalStep;
		this.speed = supertonicSpeed;
		this.nextId = 1;
		this.pending = new Map();
		this.closed = false;

		this.ready = (async () => {
			const started = Date.now();
			this.tts = await loadTextToSpeech(supertonicOnnxDir, false);
			this.style = loadVoiceStyle([supertonicVoiceStyle]);
			this.sampleRate = this.tts.sampleRate;
			log(
				"tts",
				`supertonic ready sampleRate=${this.sampleRate} voice=${supertonicVoiceStyle} elapsed_ms=${Date.now() - started}`,
			);
		})();
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
		this.pending.set(id, request);
		callbacks.onStart(this.sampleRate);

		void (async () => {
			try {
				const { wav } = await this.tts.call(
					clean,
					this.lang,
					this.style,
					this.totalStep,
					this.speed,
					0.08,
				);
				const current = this.pending.get(id);
				if (!current || current.cancelled) return;
				log(
					"tts",
					`supertonic first_audio id=${id} latency_ms=${Date.now() - started}`,
				);
				callbacks.onAudio(floatWavToPcm16(wav));
				this.pending.delete(id);
				log(
					"tts",
					`supertonic generated id=${id} elapsed_ms=${Date.now() - started}`,
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
		})();

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
