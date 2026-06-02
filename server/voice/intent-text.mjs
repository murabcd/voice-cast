export function isAsciiLetter(character) {
	const code = character.codePointAt(0);
	return (
		code !== undefined &&
		((code >= 65 && code <= 90) || (code >= 97 && code <= 122))
	);
}

export function isRussianLetter(character) {
	const code = character.codePointAt(0);
	return code === 1025 || code === 1105 || (code >= 1040 && code <= 1103);
}

export function isDigit(character) {
	const code = character.codePointAt(0);
	return code !== undefined && code >= 48 && code <= 57;
}

export function isIntentTokenCharacter(character) {
	return (
		isAsciiLetter(character) || isRussianLetter(character) || isDigit(character)
	);
}

export function normalizeIntentText(value) {
	return tokenizeIntentText(value).join(" ");
}

export function tokenizeIntentText(value) {
	const tokens = [];
	let token = "";
	for (const character of String(value ?? "").toLowerCase()) {
		if (isIntentTokenCharacter(character)) {
			token += character;
			continue;
		}
		if (token) tokens.push(token);
		token = "";
	}
	if (token) tokens.push(token);
	return tokens;
}

export function hasAnyToken(tokens, words) {
	return tokens.some((token) => words.has(token));
}

export function hasAnyPrefix(tokens, prefixes) {
	return tokens.some((token) =>
		prefixes.some((prefix) => token.startsWith(prefix)),
	);
}

export function hasPhrase(normalizedText, phrase) {
	return ` ${normalizedText} `.includes(` ${phrase} `);
}

export function hasAnyPhrase(normalizedText, phrases) {
	return phrases.some((phrase) => hasPhrase(normalizedText, phrase));
}

export function hasOrderedTerms(
	tokens,
	terms,
	maxGap = Number.POSITIVE_INFINITY,
) {
	let cursor = 0;
	let previousIndex = -1;
	for (const term of terms) {
		const foundIndex = tokens.findIndex((token, index) => {
			if (index < cursor) return false;
			if (previousIndex >= 0 && index - previousIndex - 1 > maxGap)
				return false;
			if (typeof term === "string") return token === term;
			return term(token);
		});
		if (foundIndex < 0) return false;
		previousIndex = foundIndex;
		cursor = foundIndex + 1;
	}
	return true;
}

export function hasCapitalizedAsciiToken(value, minimumLength = 3) {
	let token = "";
	for (const character of String(value ?? "")) {
		const lower = character.toLowerCase();
		const upper = character.toUpperCase();
		if (lower !== upper) {
			token += character;
			continue;
		}
		if (isCapitalizedAsciiToken(token, minimumLength)) return true;
		token = "";
	}
	return isCapitalizedAsciiToken(token, minimumLength);
}

export function hasUppercaseLetterSequence(value, minimumCount = 3) {
	let count = 0;
	for (const character of String(value ?? "")) {
		const upper = character.toUpperCase();
		const lower = character.toLowerCase();
		if (upper === lower || character !== upper) continue;
		count += 1;
		if (count >= minimumCount) return true;
	}
	return false;
}

function isCapitalizedAsciiToken(token, minimumLength) {
	if (token.length < minimumLength) return false;
	const first = token[0];
	return first >= "A" && first <= "Z";
}
