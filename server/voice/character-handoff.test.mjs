import { describe, expect, it } from "vitest";
import { resolveCharacterPreset } from "./character-context.mjs";
import {
	buildCharacterHandoffPayload,
	characterHandoffReply,
	selectCharacterHandoff,
} from "./character-handoff.mjs";

describe("character handoff policy", () => {
	it("selects a requested English character handoff", () => {
		expect(selectCharacterHandoff("switch me to Disco Robot", 1)).toMatchObject(
			{
				id: 3,
				name: "Disco Robot",
				voiceName: "M2",
			},
		);
	});

	it("selects a requested Russian character handoff", () => {
		expect(
			selectCharacterHandoff("передай меня диско роботу", 1),
		).toMatchObject({
			id: 3,
			name: "Disco Robot",
			voiceName: "M2",
		});
	});

	it("selects Russian handoff forms from STT output", () => {
		expect(selectCharacterHandoff("это позови вампиршу", 1)).toMatchObject({
			id: 2,
			name: "Vampire Girl",
			voiceName: "F1",
		});
		expect(
			selectCharacterHandoff("Слышишь, позови вам пиршу.", 1),
		).toMatchObject({
			id: 2,
			name: "Vampire Girl",
			voiceName: "F1",
		});
		expect(
			selectCharacterHandoff("Переведи меня на хакер бабушку.", 1),
		).toMatchObject({
			id: 5,
			name: "Hacker Grandma",
			voiceName: "F2",
		});
		expect(
			selectCharacterHandoff("Окей, переведи меня на Вампир Герл.", 1),
		).toMatchObject({
			id: 2,
			name: "Vampire Girl",
			voiceName: "F1",
		});
		expect(selectCharacterHandoff("Позови хакер бабушку.", 1)).toMatchObject({
			id: 5,
			name: "Hacker Grandma",
			voiceName: "F2",
		});
		expect(selectCharacterHandoff("Переведи на дискоробота.", 1)).toMatchObject(
			{
				id: 3,
				name: "Disco Robot",
				voiceName: "M2",
			},
		);
		expect(
			selectCharacterHandoff("Окей, перейди на диско робота.", 5),
		).toMatchObject({
			id: 3,
			name: "Disco Robot",
			voiceName: "M2",
		});
	});

	it("selects simplified Russian character names", () => {
		expect(selectCharacterHandoff("позови робота", 1)).toMatchObject({
			id: 3,
			name: "Disco Robot",
			voiceName: "M2",
		});
		expect(selectCharacterHandoff("позови инопланетянина", 1)).toMatchObject({
			id: 4,
			name: "Alien Chef",
			voiceName: "M3",
		});
		expect(selectCharacterHandoff("позови бабушку", 1)).toMatchObject({
			id: 5,
			name: "Hacker Grandma",
			voiceName: "F2",
		});
		expect(selectCharacterHandoff("позови волшебника", 1)).toMatchObject({
			id: 6,
			name: "Grumpy Wizard",
			voiceName: "M4",
		});
		expect(selectCharacterHandoff("позови принцессу", 1)).toMatchObject({
			id: 7,
			name: "Knight Princess",
			voiceName: "F3",
		});
		expect(selectCharacterHandoff("зови принцесса", 5)).toMatchObject({
			id: 7,
			name: "Knight Princess",
			voiceName: "F3",
		});
		expect(selectCharacterHandoff("позови пирата", 1)).toMatchObject({
			id: 8,
			name: "Space Pirate",
			voiceName: "M5",
		});
		expect(selectCharacterHandoff("позови короля", 1)).toMatchObject({
			id: 9,
			name: "Wise King",
			voiceName: "M1",
		});
	});

	it("does not switch when a character is only mentioned", () => {
		expect(selectCharacterHandoff("who is Disco Robot?", 1)).toBeUndefined();
		expect(selectCharacterHandoff("диска робота", 1)).toBeUndefined();
	});

	it("does not switch to the already selected character", () => {
		expect(selectCharacterHandoff("switch to Disco Robot", 3)).toBeUndefined();
	});

	it("builds structured handoff payloads for logs and receiving context", () => {
		expect(
			buildCharacterHandoffPayload({
				assistantConfirmation: "Переключаю на Бабушку.",
				fromCharacter: resolveCharacterPreset(3),
				fromVoiceName: "M2",
				language: "ru",
				toCharacter: resolveCharacterPreset(5),
				userRequest: "Позови бабушку.",
			}),
		).toEqual({
			from_character_id: 3,
			from_character_name: "Ро́бот",
			from_voice_name: "M2",
			to_character_id: 5,
			to_character_name: "Бабушка",
			to_voice_name: "F2",
			user_request: "Позови бабушку.",
			rationale_for_transfer:
				"Пользователь явно попросил переключить разговор на персонажа Бабушка.",
			conversation_context:
				"Ро́бот принял запрос на переключение и начал передачу.",
			open_task:
				"Поздороваться как принимающий персонаж и продолжить с ближайшего запроса пользователя.",
			assistant_confirmation: "Переключаю на Бабушку.",
		});
	});

	it("builds deterministic handoff confirmations", () => {
		expect(
			characterHandoffReply({
				character: {
					name: "Disco Robot",
					spokenName: { en: "Disco Robot", ru: "Ро́бота" },
				},
				language: "ru",
			}),
		).toBe("Переключаю на Ро́бота.");
		expect(
			characterHandoffReply({
				character: {
					name: "Disco Robot",
					spokenName: { en: "Disco Robot", ru: "Ро́бота" },
				},
				language: "en",
			}),
		).toBe("Switching you to Disco Robot.");
	});
});
