export const webActionWords = new Set([
	"browse",
	"google",
	"search",
	"загугли",
	"зайди",
	"найди",
	"открой",
	"поищи",
	"посмотри",
	"проверь",
]);

export const webContextWords = new Set([
	"браузер",
	"веб",
	"интернет",
	"онлайн",
	"сайт",
	"сети",
]);

export const directWebPhrases = [
	"check online",
	"find online",
	"look up",
	"по буквам",
];

export const directWeatherPrefixes = ["погод", "температур"];
export const directWeatherWords = new Set(["forecast", "прогноз", "weather"]);
export const spelledLetterPhrases = ["букв", "латиниц"];

export const externalTopicWords = new Set([
	"company",
	"current",
	"github",
	"internet",
	"latest",
	"news",
	"online",
	"price",
	"recent",
	"schedule",
	"site",
	"today",
	"tomorrow",
	"weather",
	"web",
	"website",
	"yesterday",
]);

export const externalTopicPhrases = ["find online", "hugging face", "look up"];

export const externalTopicPrefixes = [
	"актуальн",
	"документац",
	"компани",
	"новост",
	"погод",
	"последн",
	"расписан",
	"свеж",
	"цен",
];

export const externalTopicExactWords = new Set(["сайт"]);

export const mutableFactWords = new Set([
	"cost",
	"current",
	"docs",
	"documentation",
	"latest",
	"news",
	"price",
	"pricing",
	"recent",
	"release",
	"schedule",
	"today",
	"version",
	"weather",
]);

export const mutableFactPrefixes = [
	"актуальн",
	"верс",
	"дешев",
	"дорог",
	"документац",
	"новост",
	"погод",
	"последн",
	"прайс",
	"расписан",
	"релиз",
	"свеж",
	"стоимост",
	"тариф",
	"цен",
];

export const mutableFactExactWords = new Set([
	"сейчас",
	"сегодня",
	"стоит",
	"стоят",
]);

export const greetingWords = new Set([
	"ага",
	"да",
	"давай",
	"здравствуй",
	"нет",
	"окей",
	"привет",
	"слушай",
	"хорошо",
	"hello",
	"hey",
	"hi",
	"no",
	"ok",
	"okay",
	"yes",
]);

export const localConversationPhrases = [
	"can you hear me",
	"кто ты",
	"расскажи о себе",
	"tell me about yourself",
	"ты меня слышишь",
	"что ты умеешь",
	"what can you do",
];

export const questionWords = new Set([
	"what",
	"when",
	"where",
	"who",
	"где",
	"какая",
	"какой",
	"когда",
	"кто",
	"что",
]);

export const localFollowUpPhrases = [
	"how would you pronounce",
	"how would you say",
	"read it",
	"say it",
	"what did you say",
	"what would you say",
	"как бы ты сказал",
	"как произнос",
	"как чита",
	"прочитай",
	"скажи это",
	"что бы ты сказал",
	"что ты сказал",
];

export const referenceFollowUpPhrases = [
	"how about",
	"is that still true",
	"source",
	"sources",
	"what about",
	"актуальн",
	"источник",
	"источники",
	"это все еще",
	"это всё ещё",
];

export const domainSuffixes = new Set([
	"ai",
	"com",
	"dev",
	"io",
	"net",
	"org",
	"ru",
]);
