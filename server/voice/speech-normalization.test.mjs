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
				"Создания виджетов для цифровых каналов и цифровой платформы. Текстовые мессенджеры. Проверю. Обновим. Адрес и адреса. На автопилоте, без ударения, с задачами, в багаже, от веса, Уральские Авиалинии.",
			),
		).toBe(
			"Создания ви́джетов для цифровы́х каналов и цифрово́й платформы. Текстовые ме́ссенджеры. Прове́рю. Обнови́м. А́дрес и адреса. На автопило́те, без ударе́ния, с зада́чами, в багаже́, от ве́са, Ура́льские Авиа́линии.",
		);
		expect(normalizeRussianSpeechText("Упомянутые и упомянутые.")).toBe(
			"Упомя́нутые и упомя́нутые.",
		);
		expect(normalizeRussianSpeechText("Нужна помощь и нужна пауза.")).toBe(
			"Нужна́ помощь и нужна́ пауза.",
		);
	});

	it("expands percent signs for Russian speech", () => {
		expect(normalizeRussianSpeechText("Доля выросла до 44%.")).toBe(
			"Доля выросла до сорок четыре процента.",
		);
		expect(normalizeRussianSpeechText("Снижение до 90%.")).toBe(
			"Снижение до девя́носто процентов.",
		);
		expect(normalizeRussianSpeechText("Это 1%, 2%, 5% и 21%.")).toBe(
			"Это один процент, два процента, пять процентов и двадцать один процент.",
		);
	});

	it("does not rewrite unrelated Russian words that only contain known stems", () => {
		expect(
			normalizeRussianSpeechText("Провиджетовый тест и цифровизация."),
		).toBe("Провиджетовый тест и цифровизация.");
	});
});
