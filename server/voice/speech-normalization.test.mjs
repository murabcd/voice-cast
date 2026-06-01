import { describe, expect, it } from "vitest";
import { normalizeRussianSpeechText } from "./speech-normalization.mjs";

describe("Russian speech normalization", () => {
	it("normalizes known latin product names for Russian speech", () => {
		expect(
			normalizeRussianSpeechText(
				"OpenAI, GitHub, SmolLM3, Qwen3 и Supertonic.",
			),
		).toBe("Оупен эй-ай, Гитхаб, Смол эл-эл-эм три, Куэн три и Супертоник.");
	});

	it("spells uppercase latin acronyms and digit suffixes", () => {
		expect(normalizeRussianSpeechText("API, URL, F1 и TTS.")).toBe(
			"эй-пи-ай, ю-ар-эл, эф один и ти-ти-эс.",
		);
	});

	it("transliterates unknown latin words conservatively", () => {
		expect(normalizeRussianSpeechText("Flomni и FloomNe.")).toBe(
			"Фломни и Флумни.",
		);
	});

	it("adds stress marks for known Russian pronunciation failures", () => {
		expect(
			normalizeRussianSpeechText(
				"Создания виджетов для цифровых каналов и цифровой платформы.",
			),
		).toBe("Создания ви́джетов для цифровы́х каналов и цифрово́й платформы.");
	});

	it("does not rewrite unrelated Russian words that only contain known stems", () => {
		expect(
			normalizeRussianSpeechText("Провиджетовый тест и цифровизация."),
		).toBe("Провиджетовый тест и цифровизация.");
	});
});
