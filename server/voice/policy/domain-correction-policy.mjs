const domainLabelCorrections = new Map([
	["floomne", "flomni"],
	["flomny", "flomni"],
	["flowny", "flomni"],
]);

export function correctSpokenDomainLabel(token) {
	return domainLabelCorrections.get(token) ?? token;
}
