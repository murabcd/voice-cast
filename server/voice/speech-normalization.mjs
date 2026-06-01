const latinTokenRe = /\b[A-Za-z][A-Za-z0-9.+-]*\b/g;

const russianPronunciationRewrites = [
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
		.replace(latinTokenRe, (token) => pronounceLatinToken(token))
		.replace(/\s+/g, " ")
		.trim();
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
