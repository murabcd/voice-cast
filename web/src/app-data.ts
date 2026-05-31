import type { Character, LanguageOption } from "./app-types";
import alienChefImage from "./assets/characters/alien-chef-16x9.png";
import discoRobotImage from "./assets/characters/disco-robot-16x9.png";
import firefighterImage from "./assets/characters/firefighter-16x9.png";
import grumpyWizardImage from "./assets/characters/grumpy-wizard-16x9.png";
import hackerGrandmaImage from "./assets/characters/hacker-grandma-16x9.png";
import knightPrincessImage from "./assets/characters/knight-princess-16x9.png";
import spacePirateImage from "./assets/characters/space-pirate-16x9.png";
import vampireGirlImage from "./assets/characters/vampire-girl-16x9.png";
import wiseKingImage from "./assets/characters/wise-king-16x9.png";

export const characters: Character[] = [
	{
		id: 1,
		name: "Firefighter",
		image: firefighterImage,
		prompts: {
			en: "Speak like a kind cartoon firefighter: calm, confident, and practical, with short useful answers.",
			ru: "Ты говоришь как добрый мультяшный пожарный: спокойно, уверенно и с короткими практичными ответами.",
		},
		jaw: { x: 45.5, y: 48, width: 14, height: 11 },
	},
	{
		id: 2,
		name: "Vampire Girl",
		image: vampireGirlImage,
		prompts: {
			en: "Speak like a friendly cartoon vampire girl: slightly mysterious, but clear and to the point.",
			ru: "Ты говоришь как дружелюбная мультяшная вампирша: чуть загадочно, но понятно и по делу.",
		},
		jaw: { x: 48.9, y: 58.5, width: 10.5, height: 4.4 },
	},
	{
		id: 3,
		name: "Disco Robot",
		image: discoRobotImage,
		prompts: {
			en: "Speak like a cheerful disco robot: energetic, concise, and clearly structured.",
			ru: "Ты говоришь как веселый диско-робот: энергично, лаконично, с ясной структурой.",
		},
		jaw: { x: 47, y: 42, width: 11, height: 9 },
	},
	{
		id: 4,
		name: "Alien Chef",
		image: alienChefImage,
		prompts: {
			en: "Speak like a cartoon alien chef: warm and vivid, but without long monologues.",
			ru: "Ты говоришь как мультяшный инопланетный шеф: тепло, образно, но без длинных монологов.",
		},
		jaw: { x: 50, y: 39, width: 11, height: 9 },
	},
	{
		id: 5,
		name: "Hacker Grandma",
		image: hackerGrandmaImage,
		prompts: {
			en: "Speak like a cartoon hacker grandma: smart and warm, with short clear advice.",
			ru: "Ты говоришь как мультяшная хакер-бабушка: умно, тепло, с короткими ясными советами.",
		},
		jaw: { x: 45, y: 41, width: 11, height: 10 },
	},
	{
		id: 6,
		name: "Grumpy Wizard",
		image: grumpyWizardImage,
		prompts: {
			en: "Speak like a grumpy but kind wizard: full of character, but helpful and easy to understand.",
			ru: "Ты говоришь как ворчливый, но добрый волшебник: с характером, но полезно и понятно.",
		},
		jaw: { x: 50, y: 47, width: 12, height: 10 },
	},
	{
		id: 7,
		name: "Knight Princess",
		image: knightPrincessImage,
		prompts: {
			en: "Speak like a brave cartoon knight princess: confident, caring, and brief.",
			ru: "Ты говоришь как храбрая мультяшная принцесса-рыцарь: уверенно, заботливо и кратко.",
		},
		jaw: { x: 47, y: 40, width: 10, height: 9 },
	},
	{
		id: 8,
		name: "Space Pirate",
		image: spacePirateImage,
		prompts: {
			en: "Speak like a space pirate: lively and bold, but friendly.",
			ru: "Ты говоришь как космический пират: живо, дерзко, но дружелюбно.",
		},
		jaw: { x: 47, y: 41, width: 11, height: 10 },
	},
	{
		id: 9,
		name: "Wise King",
		image: wiseKingImage,
		prompts: {
			en: "Speak like a wise cartoon king: calm, precise, and without unnecessary ceremony.",
			ru: "Ты говоришь как мудрый мультяшный король: спокойно, точно, без лишней церемонии.",
		},
		jaw: { x: 45, y: 43, width: 11, height: 10 },
	},
];

export const languages: LanguageOption[] = [
	{ code: "ru", name: "Russian" },
	{ code: "en", name: "English" },
	{ code: "es", name: "Spanish" },
	{ code: "fr", name: "French" },
	{ code: "de", name: "German" },
	{ code: "it", name: "Italian" },
	{ code: "pt", name: "Portuguese" },
	{ code: "ja", name: "Japanese" },
	{ code: "ko", name: "Korean" },
	{ code: "uk", name: "Ukrainian" },
	{ code: "ar", name: "Arabic" },
	{ code: "bg", name: "Bulgarian" },
	{ code: "cs", name: "Czech" },
	{ code: "da", name: "Danish" },
	{ code: "el", name: "Greek" },
	{ code: "et", name: "Estonian" },
	{ code: "fi", name: "Finnish" },
	{ code: "hi", name: "Hindi" },
	{ code: "hr", name: "Croatian" },
	{ code: "hu", name: "Hungarian" },
	{ code: "id", name: "Indonesian" },
	{ code: "lt", name: "Lithuanian" },
	{ code: "lv", name: "Latvian" },
	{ code: "nl", name: "Dutch" },
	{ code: "pl", name: "Polish" },
	{ code: "ro", name: "Romanian" },
	{ code: "sk", name: "Slovak" },
	{ code: "sl", name: "Slovenian" },
	{ code: "sv", name: "Swedish" },
	{ code: "tr", name: "Turkish" },
	{ code: "vi", name: "Vietnamese" },
];
