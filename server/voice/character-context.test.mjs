import { describe, expect, it } from "vitest";
import {
	canHandoffCharacter,
	greetingCharacterName,
	listCharacterPresets,
	resolveCharacterPreset,
	runtimeCharacterContext,
	spokenCharacterName,
} from "./character-context.mjs";

describe("character context", () => {
	it("resolves known character presets", () => {
		expect(resolveCharacterPreset(6)).toMatchObject({
			id: 6,
			instructions: {
				ru: "Можно слегка ворчать, но оставайся добрым и полезным.",
			},
			name: "Grumpy Wizard",
			spokenName: {
				en: "Grumpy Wizard",
				ru: "Волшебника",
			},
		});
		expect(resolveCharacterPreset(999)).toBeUndefined();
	});

	it("exposes an explicit character handoff graph", () => {
		expect(listCharacterPresets()).toHaveLength(9);
		expect(canHandoffCharacter(1, 2)).toBe(true);
		expect(canHandoffCharacter(1, 1)).toBe(false);
		expect(canHandoffCharacter(999, 1)).toBe(false);
	});

	it("builds compact server-owned character context", () => {
		const context = runtimeCharacterContext({ characterId: 6, language: "ru" });

		expect(context).toContain("## Character Context");
		expect(context).toContain("Grumpy Wizard");
		expect(context).toContain("ворчливый, но добрый волшебник");
		expect(context).toContain("Можно слегка ворчать");
		expect(context).toContain("используй мужской род");
		expect(context).toContain("Use the character only for tone");
	});

	it("uses female self-reference grammar for female characters", () => {
		const vampireContext = runtimeCharacterContext({
			characterId: 2,
			language: "ru",
		});
		const grandmaContext = runtimeCharacterContext({
			characterId: 5,
			language: "ru",
		});
		const princessContext = runtimeCharacterContext({
			characterId: 7,
			language: "ru",
		});

		expect(vampireContext).toContain("используй женский род");
		expect(grandmaContext).toContain("используй женский род");
		expect(princessContext).toContain("используй женский род");
		expect(princessContext).toContain("готова, поняла, посмотрела");
	});

	it("uses explicit first-person point of view in English", () => {
		expect(
			runtimeCharacterContext({ characterId: 7, language: "en" }),
		).toContain("female first-person point of view");
		expect(
			runtimeCharacterContext({ characterId: 1, language: "en" }),
		).toContain("male first-person point of view");
	});

	it("keeps internal names stable while localizing spoken names", () => {
		const character = resolveCharacterPreset(5);

		expect(character).toMatchObject({ name: "Hacker Grandma" });
		expect(greetingCharacterName(character, "ru")).toBe("Бабушка");
		expect(spokenCharacterName(character, "ru")).toBe("Бабушку");
		expect(spokenCharacterName(character, "en")).toBe("Hacker Grandma");
	});
});
