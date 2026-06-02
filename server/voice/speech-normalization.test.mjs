import { describe, expect, it } from "vitest";
import { domainPronunciationLexicon } from "./policy/pronunciation-policy.mjs";
import {
	russianStressLexicon,
	validateRussianStressEntry,
} from "./russian-stress-lexicon.mjs";
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
		expect(
			normalizeRussianSpeechText(
				"Вот информация с десятью каналами, одному пользователю и двумя командами.",
			),
		).toBe(
			"Вот информация с десятью́ каналами, одному́ пользователю и двумя́ командами.",
		);
		expect(
			normalizeRussianSpeechText(
				"С тремя задачами, четырьмя каналами, пятью проектами, шестью файлами, семью участниками, восемью статусами и девятью ответами.",
			),
		).toBe(
			"С тремя́ зада́чами, четырьмя́ каналами, пятью́ проектами, шестью́ файлами, семью́ участниками, восемью́ статусами и девятью́ ответами.",
		);
		expect(
			normalizeRussianSpeechText(
				"Для одного клиента, одной команды, одну задачу, одним каналом и одними настройками.",
			),
		).toBe(
			"Для одного́ клиента, одно́й команды, одну́ задачу, одни́м каналом и одни́ми настройками.",
		);
		expect(
			normalizeRussianSpeechText(
				"Нужно понять, почему сейчас можно сделать лучше, поэтому начнем сначала.",
			),
		).toBe(
			"Ну́жно понять, почему́ сейча́с мо́жно сделать лу́чше, поэ́тому начнем снача́ла.",
		);
		expect(
			normalizeRussianSpeechText(
				"Который пользователь должен выбрать первый вариант.",
			),
		).toBe("Кото́рый пользователь до́лжен выбрать пе́рвый вариант.");
	});

	it("does not double-stress already stressed common Russian words", () => {
		expect(normalizeRussianSpeechText("Нужна́ помощь сейча́с.")).toBe(
			"Нужна́ помощь сейча́с.",
		);
	});

	it("expands Russian abbreviations that TTS reads letter-by-letter", () => {
		expect(
			normalizeRussianSpeechText("Интеграции, виджеты и др. функции, и т.д."),
		).toBe("Интеграции, ви́джеты и другое функции, и так далее.");
		expect(normalizeRussianSpeechText("Каналы и тд доступны.")).toBe(
			"Каналы и так далее доступны.",
		);
	});

	it("keeps the Russian stress lexicon normalized", () => {
		for (const [source, stressed] of russianStressLexicon) {
			expect(validateRussianStressEntry(source, stressed)).toBeUndefined();
		}
	});

	it("keeps ordinary Russian stress separate from pronunciation policy rewrites", () => {
		expect(russianStressLexicon.has("нужна")).toBe(true);
		expect(russianStressLexicon.has("десятью")).toBe(true);
		expect(russianStressLexicon.has("включая")).toBe(true);
		expect(russianStressLexicon.has("адрес")).toBe(true);
		expect(russianStressLexicon.has("уральские авиалинии")).toBe(false);
		expect(domainPronunciationLexicon.has("уральские авиалинии")).toBe(true);
		expect(domainPronunciationLexicon.has("нужна")).toBe(false);
		expect(domainPronunciationLexicon.has("десятью")).toBe(false);
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
