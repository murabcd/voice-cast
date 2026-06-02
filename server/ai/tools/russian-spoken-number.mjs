const digitWords = new Map([
	["ноль", 0],
	["нуль", 0],
	["один", 1],
	["одна", 1],
	["два", 2],
	["две", 2],
	["три", 3],
	["четыре", 4],
	["пять", 5],
	["шесть", 6],
	["семь", 7],
	["восемь", 8],
	["девять", 9],
]);

const teenWords = new Map([
	["десять", 10],
	["одиннадцать", 11],
	["двенадцать", 12],
	["тринадцать", 13],
	["четырнадцать", 14],
	["пятнадцать", 15],
	["шестнадцать", 16],
	["семнадцать", 17],
	["восемнадцать", 18],
	["девятнадцать", 19],
]);

const tensWords = new Map([
	["двадцать", 20],
	["тридцать", 30],
	["сорок", 40],
	["пятьдесят", 50],
	["шестьдесят", 60],
	["семьдесят", 70],
	["восемьдесят", 80],
	["девяносто", 90],
]);

const hundredWords = new Map([
	["сто", 100],
	["двести", 200],
	["триста", 300],
	["четыреста", 400],
	["пятьсот", 500],
	["шестьсот", 600],
	["семьсот", 700],
	["восемьсот", 800],
	["девятьсот", 900],
]);

const scaleWords = new Map([
	["тысяча", 1000],
	["тысячи", 1000],
	["тысяч", 1000],
]);

const ignoredWords = new Set(["и"]);

function isRussianLetter(char) {
	const lower = char.toLowerCase();
	return lower === "ё" || (lower >= "а" && lower <= "я");
}

function normalizedWords(text) {
	const words = [];
	let current = "";
	for (const char of String(text ?? "").toLowerCase()) {
		if (isRussianLetter(char)) {
			current += char;
			continue;
		}
		if (current) {
			words.push(current);
			current = "";
		}
	}
	if (current) words.push(current);
	return words;
}

function parseSpokenInteger(words) {
	let total = 0;
	let group = 0;
	let consumed = 0;
	for (const word of words) {
		if (ignoredWords.has(word)) {
			consumed += 1;
			continue;
		}
		if (digitWords.has(word)) {
			group += digitWords.get(word);
			consumed += 1;
			continue;
		}
		if (teenWords.has(word)) {
			group += teenWords.get(word);
			consumed += 1;
			continue;
		}
		if (tensWords.has(word)) {
			group += tensWords.get(word);
			consumed += 1;
			continue;
		}
		if (hundredWords.has(word)) {
			group += hundredWords.get(word);
			consumed += 1;
			continue;
		}
		if (scaleWords.has(word)) {
			const scale = scaleWords.get(word);
			total += (group || 1) * scale;
			group = 0;
			consumed += 1;
			continue;
		}
		break;
	}
	if (consumed === 0) return undefined;
	return { value: total + group, consumed };
}

function parseDigitSequence(words) {
	const digits = [];
	for (const word of words) {
		if (!digitWords.has(word)) break;
		digits.push(String(digitWords.get(word)));
	}
	if (digits.length < 2) return undefined;
	return { value: Number(digits.join("")), consumed: digits.length };
}

function parseNumberChunk(words) {
	const first = words[0];
	if (digitWords.has(first)) {
		return { text: String(digitWords.get(first)), consumed: 1 };
	}
	if (teenWords.has(first)) {
		return { text: String(teenWords.get(first)), consumed: 1 };
	}
	if (tensWords.has(first)) {
		const ones = digitWords.get(words[1]);
		return {
			text: String(tensWords.get(first) + (ones && ones < 10 ? ones : 0)),
			consumed: ones && ones < 10 ? 2 : 1,
		};
	}
	if (hundredWords.has(first)) {
		const parsed = parseSpokenInteger(words);
		if (parsed?.value >= 100 && parsed.value <= 999) {
			return { text: String(parsed.value), consumed: parsed.consumed };
		}
	}
	return undefined;
}

function parseTicketNumberChunks(words) {
	const chunks = [];
	let consumed = 0;
	while (consumed < words.length) {
		const chunk = parseNumberChunk(words.slice(consumed));
		if (!chunk) break;
		chunks.push(chunk.text);
		consumed += chunk.consumed;
	}
	if (chunks.length < 2) return undefined;
	return { value: Number(chunks.join("")), consumed };
}

export function parseRussianSpokenNumberPrefix(words) {
	const normalized = words
		.map((word) => String(word ?? "").toLowerCase())
		.filter(Boolean);
	const parsed =
		parseTicketNumberChunks(normalized) ??
		parseDigitSequence(normalized) ??
		parseSpokenInteger(normalized);
	return parsed?.value > 0 ? String(parsed.value) : "";
}

export function extractRussianSpokenNumber(text) {
	const words = normalizedWords(text);
	for (let index = 0; index < words.length; index += 1) {
		const parsed = parseRussianSpokenNumberPrefix(words.slice(index));
		if (parsed) return parsed;
	}
	return "";
}
