const latinTokenRe = /\b[A-Za-z][A-Za-z0-9.+-]*\b/g;
const percentRe = /(\d+(?:[.,]\d+)?)\s*%/g;

const russianPronunciationRewrites = [
	[/(?<![А-Яа-яЁё])Уральские Авиалинии(?![А-Яа-яЁё])/g, "Ура́льские Авиа́линии"],
	[/(?<![А-Яа-яЁё])уральские авиалинии(?![А-Яа-яЁё])/g, "ура́льские авиа́линии"],
	[/(?<![А-Яа-яЁё])Автопилоте(?![А-Яа-яЁё])/g, "Автопило́те"],
	[/(?<![А-Яа-яЁё])автопилоте(?![А-Яа-яЁё])/g, "автопило́те"],
	[/(?<![А-Яа-яЁё])Ударения(?![А-Яа-яЁё])/g, "Ударе́ния"],
	[/(?<![А-Яа-яЁё])ударения(?![А-Яа-яЁё])/g, "ударе́ния"],
	[/(?<![А-Яа-яЁё])Задачами(?![А-Яа-яЁё])/g, "Зада́чами"],
	[/(?<![А-Яа-яЁё])задачами(?![А-Яа-яЁё])/g, "зада́чами"],
	[/(?<![А-Яа-яЁё])Багаже(?![А-Яа-яЁё])/g, "Багаже́"],
	[/(?<![А-Яа-яЁё])багаже(?![А-Яа-яЁё])/g, "багаже́"],
	[/(?<![А-Яа-яЁё])Веса(?![А-Яа-яЁё])/g, "Ве́са"],
	[/(?<![А-Яа-яЁё])веса(?![А-Яа-яЁё])/g, "ве́са"],
	[/(?<![А-Яа-яЁё])Адресом(?![А-Яа-яЁё])/g, "Адре́сом"],
	[/(?<![А-Яа-яЁё])адресом(?![А-Яа-яЁё])/g, "адре́сом"],
	[/(?<![А-Яа-яЁё])Адресе(?![А-Яа-яЁё])/g, "Адре́се"],
	[/(?<![А-Яа-яЁё])адресе(?![А-Яа-яЁё])/g, "адре́се"],
	[/(?<![А-Яа-яЁё])Адрес(?![А-Яа-яЁё])/g, "А́дрес"],
	[/(?<![А-Яа-яЁё])адрес(?![А-Яа-яЁё])/g, "а́дрес"],
	[/(?<![А-Яа-яЁё])виджетов(?![А-Яа-яЁё])/gi, "ви́джетов"],
	[/(?<![А-Яа-яЁё])виджетами(?![А-Яа-яЁё])/gi, "ви́джетами"],
	[/(?<![А-Яа-яЁё])виджеты(?![А-Яа-яЁё])/gi, "ви́джеты"],
	[/(?<![А-Яа-яЁё])виджет(?![А-Яа-яЁё])/gi, "ви́джет"],
	[/(?<![А-Яа-яЁё])цифровых(?![А-Яа-яЁё])/gi, "цифровы́х"],
	[/(?<![А-Яа-яЁё])цифровыми(?![А-Яа-яЁё])/gi, "цифровы́ми"],
	[/(?<![А-Яа-яЁё])цифровые(?![А-Яа-яЁё])/gi, "цифровы́е"],
	[/(?<![А-Яа-яЁё])цифровой(?![А-Яа-яЁё])/gi, "цифрово́й"],
	[/(?<![А-Яа-яЁё])цифровая(?![А-Яа-яЁё])/gi, "цифрова́я"],
	[/(?<![А-Яа-яЁё])цифровое(?![А-Яа-яЁё])/gi, "цифрово́е"],
	[/(?<![А-Яа-яЁё])мессенджеров(?![А-Яа-яЁё])/gi, "ме́ссенджеров"],
	[/(?<![А-Яа-яЁё])мессенджерами(?![А-Яа-яЁё])/gi, "ме́ссенджерами"],
	[/(?<![А-Яа-яЁё])мессенджеры(?![А-Яа-яЁё])/gi, "ме́ссенджеры"],
	[/(?<![А-Яа-яЁё])мессенджер(?![А-Яа-яЁё])/gi, "ме́ссенджер"],
	[/(?<![А-Яа-яЁё])Проверю(?![А-Яа-яЁё])/g, "Прове́рю"],
	[/(?<![А-Яа-яЁё])проверю(?![А-Яа-яЁё])/g, "прове́рю"],
	[/(?<![А-Яа-яЁё])Обновим(?![А-Яа-яЁё])/g, "Обнови́м"],
	[/(?<![А-Яа-яЁё])обновим(?![А-Яа-яЁё])/g, "обнови́м"],
];
const letterNames = {
	a: "эй",
	b: "би",
	c: "си",
	d: "ди",
	e: "и",
	f: "эф",
	g: "джи",
	h: "эйч",
	i: "ай",
	j: "джей",
	k: "кей",
	l: "эл",
	m: "эм",
	n: "эн",
	o: "оу",
	p: "пи",
	q: "кью",
	r: "ар",
	s: "эс",
	t: "ти",
	u: "ю",
	v: "ви",
	w: "дабл-ю",
	x: "икс",
	y: "уай",
	z: "зед",
};
const digitNames = {
	0: "ноль",
	1: "один",
	2: "два",
	3: "три",
	4: "четыре",
	5: "пять",
	6: "шесть",
	7: "семь",
	8: "восемь",
	9: "девять",
};
const numberOnes = [
	"ноль",
	"один",
	"два",
	"три",
	"четыре",
	"пять",
	"шесть",
	"семь",
	"восемь",
	"девять",
];
const numberTeens = [
	"десять",
	"одиннадцать",
	"двенадцать",
	"тринадцать",
	"четырнадцать",
	"пятнадцать",
	"шестнадцать",
	"семнадцать",
	"восемнадцать",
	"девятнадцать",
];
const numberTens = {
	20: "двадцать",
	30: "тридцать",
	40: "сорок",
	50: "пятьдесят",
	60: "шестьдесят",
	70: "семьдесят",
	80: "восемьдесят",
	90: "девя́носто",
};
const numberHundreds = {
	100: "сто",
	200: "двести",
	300: "триста",
	400: "четыреста",
	500: "пятьсот",
	600: "шестьсот",
	700: "семьсот",
	800: "восемьсот",
	900: "девятьсот",
};

const spokenDictionary = new Map(
	Object.entries({
		ai: "эй-ай",
		api: "эй-пи-ай",
		cpu: "си-пи-ю",
		floomne: "Флумни",
		flomni: "Фломни",
		flone: "Флоун",
		github: "Гитхаб",
		gpu: "джи-пи-ю",
		html: "эйч-ти-эм-эл",
		http: "эйч-ти-ти-пи",
		https: "эйч-ти-ти-пи-эс",
		json: "джейсон",
		llm: "эл-эл-эм",
		mcp: "эм-си-пи",
		openai: "Оупен эй-ай",
		onnx: "онникс",
		qwen: "Куэн",
		qwen3: "Куэн три",
		smol: "Смол",
		smollm: "Смол эл-эл-эм",
		smollm3: "Смол эл-эл-эм три",
		stt: "эс-ти-ти",
		supertonic: "Супертоник",
		tts: "ти-ти-эс",
		url: "ю-ар-эл",
		ux: "ю-икс",
	}),
);
const transliterationPairs = [
	["sch", "щ"],
	["yo", "ё"],
	["zh", "ж"],
	["kh", "х"],
	["ts", "ц"],
	["ch", "ч"],
	["sh", "ш"],
	["yu", "ю"],
	["ya", "я"],
	["ye", "е"],
	["a", "а"],
	["b", "б"],
	["c", "к"],
	["d", "д"],
	["e", "е"],
	["f", "ф"],
	["g", "г"],
	["h", "х"],
	["i", "и"],
	["j", "дж"],
	["k", "к"],
	["l", "л"],
	["m", "м"],
	["n", "н"],
	["o", "о"],
	["p", "п"],
	["q", "к"],
	["r", "р"],
	["s", "с"],
	["t", "т"],
	["u", "у"],
	["v", "в"],
	["w", "в"],
	["x", "кс"],
	["y", "и"],
	["z", "з"],
];

export function normalizeRussianSpeechText(text) {
	return applyRussianPronunciationRewrites(String(text ?? ""))
		.replace(
			percentRe,
			(_match, value) =>
				`${pronounceRussianNumber(value)} ${percentWord(value)}`,
		)
		.replace(latinTokenRe, (token) => pronounceLatinToken(token))
		.replace(/\s+/g, " ")
		.trim();
}

function percentWord(value) {
	const integerPart = String(value).split(/[,.]/)[0] ?? "";
	const lastTwo = Number(integerPart.slice(-2));
	const last = Number(integerPart.slice(-1));
	if (lastTwo >= 11 && lastTwo <= 14) return "процентов";
	if (last === 1) return "процент";
	if (last >= 2 && last <= 4) return "процента";
	return "процентов";
}

function pronounceRussianNumber(value) {
	const text = String(value);
	const [integerText, fractionText] = text.split(/[,.]/);
	const integer = Number(integerText);
	if (!Number.isInteger(integer) || integer < 0 || integer > 999)
		return text.replace(".", ",");
	const integerWords = pronounceRussianInteger(integer);
	if (!fractionText) return integerWords;
	return `${integerWords} целых ${pronounceDigits(fractionText)}`;
}

function pronounceRussianInteger(value) {
	if (value < 10) return numberOnes[value];
	if (value < 20) return numberTeens[value - 10];
	if (value < 100) {
		const tens = Math.floor(value / 10) * 10;
		const ones = value % 10;
		return [numberTens[tens], ones ? numberOnes[ones] : ""]
			.filter(Boolean)
			.join(" ");
	}
	const hundreds = Math.floor(value / 100) * 100;
	const rest = value % 100;
	return [numberHundreds[hundreds], rest ? pronounceRussianInteger(rest) : ""]
		.filter(Boolean)
		.join(" ");
}

function pronounceLatinToken(token) {
	const key = token.toLowerCase();
	if (spokenDictionary.has(key)) return spokenDictionary.get(key);
	const parts = token.match(/[A-Za-z]\d+|[A-Za-z]+|\d+|[.+-]/g) ?? [token];
	return parts
		.map((part) => {
			if (/^\d+$/.test(part)) return pronounceDigits(part);
			if (/^[A-Z]{2,}$/.test(part)) return pronounceLetters(part);
			if (/^[A-Za-z]\d+$/.test(part)) {
				return `${pronounceLetters(part[0])} ${pronounceDigits(part.slice(1))}`;
			}
			if (/^[A-Za-z]+$/.test(part)) return transliterateLatinWord(part);
			if (part === "+") return "плюс";
			if (part === ".") return "точка";
			if (part === "-") return "дэш";
			return part;
		})
		.join(" ");
}

function pronounceDigits(value) {
	return [...value].map((digit) => digitNames[digit] ?? digit).join(" ");
}

function pronounceLetters(value) {
	return [...value.toLowerCase()]
		.map((letter) => letterNames[letter] ?? letter)
		.join("-");
}

function transliterateLatinWord(value) {
	let rest = value.toLowerCase();
	let out = "";
	while (rest) {
		const pair = transliterationPairs.find(([latin]) => rest.startsWith(latin));
		if (!pair) {
			out += rest[0];
			rest = rest.slice(1);
			continue;
		}
		out += pair[1];
		rest = rest.slice(pair[0].length);
	}
	return matchCapitalization(value, out);
}

function matchCapitalization(source, value) {
	if (/^[A-Z]+$/.test(source)) return value.toUpperCase();
	if (/^[A-Z]/.test(source))
		return `${value[0].toUpperCase()}${value.slice(1)}`;
	return value;
}

function applyRussianPronunciationRewrites(text) {
	return russianPronunciationRewrites.reduce(
		(out, [pattern, replacement]) => out.replace(pattern, replacement),
		text,
	);
}
