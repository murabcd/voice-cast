export const cityTimeZones = [
	{
		timeZone: "Europe/Moscow",
		patterns: [/москв/i, /\bmoscow\b/i],
		names: { ru: "Москве", en: "Moscow" },
	},
	{
		timeZone: "America/New_York",
		patterns: [/нью[-\s]?йорк/i, /\bnew\s+york\b/i],
		names: { ru: "Нью-Йорке", en: "New York" },
	},
	{
		timeZone: "Europe/London",
		patterns: [/лондон/i, /\blondon\b/i],
		names: { ru: "Лондоне", en: "London" },
	},
	{
		timeZone: "Asia/Tokyo",
		patterns: [/токио/i, /\btokyo\b/i],
		names: { ru: "Токио", en: "Tokyo" },
	},
];

export const localDateTimeRoutes = [
	{
		toolName: "current_time",
		description:
			"Return the current local time for the user's configured time zone or a city mentioned in the request.",
		parameters: {
			type: "object",
			properties: {
				location_text: {
					type: "string",
					description: "The original user text containing an optional city.",
				},
			},
			required: ["location_text"],
			additionalProperties: false,
		},
		patterns: [
			/(сколько|какое).{0,24}(сейчас\s+)?врем/i,
			/(который|какой).{0,16}час/i,
			/время\s+на\s+часах/i,
			/\b(what\s+time|current\s+time)\b/i,
		],
	},
	{
		toolName: "weekday",
		description:
			"Return the current weekday for the user's configured time zone or a city mentioned in the request.",
		parameters: {
			type: "object",
			properties: {
				location_text: {
					type: "string",
					description: "The original user text containing an optional city.",
				},
			},
			required: ["location_text"],
			additionalProperties: false,
		},
		patterns: [
			/(какой|какая).{0,24}(день\s+недели|сегодня\s+день)/i,
			/(день\s+недели|weekday)/i,
			/\bwhat\s+day\s+is\s+it\b/i,
		],
	},
	{
		toolName: "current_date",
		description:
			"Return today's date for the user's configured time zone or a city mentioned in the request.",
		parameters: {
			type: "object",
			properties: {
				location_text: {
					type: "string",
					description: "The original user text containing an optional city.",
				},
			},
			required: ["location_text"],
			additionalProperties: false,
		},
		patterns: [
			/(какая|какое|какой).{0,20}(сегодня\s+)?дат/i,
			/(какой|какая).{0,20}сегодня\s+день/i,
			/\b(today'?s?\s+date|current\s+date)\b/i,
		],
	},
];

export const russianWeekdays = [
	"воскресенье",
	"понедельник",
	"вторник",
	"среда",
	"четверг",
	"пятница",
	"суббота",
];
