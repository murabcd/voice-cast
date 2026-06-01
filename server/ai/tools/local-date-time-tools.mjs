import {
	cityTimeZones,
	localDateTimeRoutes,
	russianWeekdays,
} from "../../voice/policy/local-date-time-policy.mjs";

function matchesAny(patterns, text) {
	return patterns.some((pattern) => pattern.test(text));
}

function resolveTimeZone(text, fallbackTimeZone) {
	const known = cityTimeZones.find((city) =>
		city.patterns.some((pattern) => pattern.test(text)),
	);
	if (known) return known;
	return {
		timeZone: fallbackTimeZone || "UTC",
		names: { ru: "у вас", en: "your location" },
		local: true,
	};
}

function formatTime(date, timeZone, locale) {
	return new Intl.DateTimeFormat(locale, {
		timeZone,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(date);
}

function formatDate(date, timeZone, locale) {
	return new Intl.DateTimeFormat(locale, {
		timeZone,
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);
}

function weekdayName(date, timeZone) {
	const shortName = new Intl.DateTimeFormat("en-US", {
		timeZone,
		weekday: "short",
	})
		.formatToParts(date)
		.find((part) => part.type === "weekday")?.value;
	const weekdayIndex = [
		"Sun",
		"Mon",
		"Tue",
		"Wed",
		"Thu",
		"Fri",
		"Sat",
	].indexOf(shortName);
	return russianWeekdays[weekdayIndex] ?? "";
}

function formatLocalToolReply({ language, location, toolName, value }) {
	if (toolName === "current_time") {
		return language === "en"
			? `It is ${value} in ${location.names.en}.`
			: location.local
				? `У вас сейчас ${value}.`
				: `В ${location.names.ru} сейчас ${value}.`;
	}
	if (toolName === "weekday") {
		return language === "en"
			? `In ${location.names.en}, it is ${value}.`
			: location.local
				? `У вас сейчас ${value}.`
				: `В ${location.names.ru} сейчас ${value}.`;
	}
	return language === "en"
		? `In ${location.names.en}, today is ${value}.`
		: location.local
			? `У вас сегодня ${value}.`
			: `В ${location.names.ru} сегодня ${value}.`;
}

export const localDateTimeToolDefinitions = localDateTimeRoutes.map(
	({ toolName, description, parameters }) => ({
		name: toolName,
		namespace: "local_datetime",
		description,
		parameters,
		execution: "local",
	}),
);

export const localDateTimeNamespace = {
	name: "local_datetime",
	description:
		"Deterministic local date and time tools. Use for current time, date, or weekday questions before considering web search.",
	tools: localDateTimeToolDefinitions,
};

export function selectLocalDateTimeTool(text) {
	const prompt = String(text ?? "").trim();
	if (!prompt) return undefined;
	const route = localDateTimeRoutes.find((candidate) =>
		matchesAny(candidate.patterns, prompt),
	);
	if (!route) return undefined;
	return {
		toolName: route.toolName,
		arguments: { location_text: prompt },
	};
}

export function callLocalDateTimeTool({
	toolName,
	arguments: args,
	text,
	timeZone,
	language = "ru",
	now = new Date(),
}) {
	const prompt = String(args?.location_text ?? text ?? "").trim();
	if (!prompt) throw new Error(`${toolName} requires location_text.`);
	if (!localDateTimeRoutes.some((route) => route.toolName === toolName))
		throw new Error(`Unknown local date time tool: ${toolName}`);
	const locale = language === "en" ? "en-US" : "ru-RU";
	const location = resolveTimeZone(prompt, timeZone);
	const value =
		toolName === "current_time"
			? formatTime(now, location.timeZone, locale)
			: toolName === "weekday"
				? language === "en"
					? new Intl.DateTimeFormat("en-US", {
							timeZone: location.timeZone,
							weekday: "long",
						}).format(now)
					: weekdayName(now, location.timeZone)
				: formatDate(now, location.timeZone, locale);
	return {
		reply: formatLocalToolReply({
			language,
			location,
			toolName,
			value,
		}),
		result: {
			value,
			timeZone: location.timeZone,
		},
	};
}
