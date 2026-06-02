import stressLexiconData from "./data/russian-stress-lexicon.json" with {
	type: "json",
};

const stressMark = "\u0301";

export const russianStressLexicon = loadRussianStressLexicon(stressLexiconData);

export function validateRussianStressEntry(source, stressed) {
	if (typeof source !== "string" || typeof stressed !== "string")
		return "source and stressed value must be strings";
	if (!source) return "source must not be empty";
	if (source !== source.toLowerCase()) return "source must be lowercase";
	if (source.includes(stressMark))
		return "source must not contain stress marks";
	if (!stressed.includes(stressMark))
		return "stressed value must contain a stress mark";
	if (stressed.replaceAll(stressMark, "") !== source)
		return "stressed value must preserve source letters";
	return undefined;
}

function loadRussianStressLexicon(data) {
	if (!data || typeof data !== "object" || Array.isArray(data))
		throw new TypeError("Russian stress lexicon must be a JSON object");

	const entries = Object.entries(data);
	for (const [source, stressed] of entries) {
		const error = validateRussianStressEntry(source, stressed);
		if (error)
			throw new TypeError(`Invalid Russian stress entry ${source}: ${error}`);
	}

	return new Map(entries.sort(([left], [right]) => left.localeCompare(right)));
}
