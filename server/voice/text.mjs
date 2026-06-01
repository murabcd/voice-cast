const thinkBlockRe = /<think>[\s\S]*?<\/think>/gi;
const sentenceRe = /^(.+?[.!?…]+)(\s+|$)/s;
const markdownLinkRe = /\[([^\]]+)]\((?:https?:\/\/|www\.)[^)\s]+[^)]*\)/gi;
const bareUrlRe = /\b(?:https?:\/\/|www\.)\S+/gi;

export function cleanLlmText(text) {
	return finalizeSpokenText(stripLlmArtifacts(text));
}

export function stripLlmArtifacts(text) {
	return String(text ?? "")
		.replace(thinkBlockRe, "")
		.replaceAll("<think>", "")
		.replaceAll("</think>", "")
		.replaceAll("/no_think", "")
		.replace(markdownLinkRe, "$1")
		.replace(bareUrlRe, "");
}

export function finalizeSpokenText(text) {
	let out = String(text ?? "")
		.replace(/[`*_#>]+/g, "")
		.replace(/\((?:\s|,|-)*\)/g, "")
		.replace(/(?:^|\s)(?:подробнее|источник)\s*:\s*(?=$|\s|[.!?…])/gi, " ")
		.replace(/[:;,]\s*([.!?…])/g, "$1")
		.replace(/\s+([.!?…])/g, "$1")
		.replace(/["“”«»]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	out = out.replace(/[:;,]\s*$/g, ".");
	const lastSentence = out.match(/^(.+[.!?…])(?:\s|$)/s);
	if (lastSentence) out = lastSentence[1].trim();
	if (out && !/[.!?…]$/.test(out)) out += ".";
	return out;
}

export function createSentenceChunker() {
	let buffer = "";
	return {
		push(part) {
			const out = [];
			buffer += part;
			while (true) {
				const trimmed = buffer.trim();
				const match = trimmed.match(sentenceRe);
				if (!match) break;
				out.push(match[1].trim());
				buffer = trimmed.slice(match[1].length).trim();
			}
			return out;
		},
		flush() {
			const tail = buffer.trim();
			buffer = "";
			return tail ? [tail] : [];
		},
	};
}
