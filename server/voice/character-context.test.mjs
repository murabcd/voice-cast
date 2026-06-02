import { describe, expect, it } from "vitest";
import {
	resolveCharacterPreset,
	runtimeCharacterContext,
} from "./character-context.mjs";

describe("character context", () => {
	it("resolves known character presets", () => {
		expect(resolveCharacterPreset(6)).toMatchObject({
			id: 6,
			name: "Grumpy Wizard",
		});
		expect(resolveCharacterPreset(999)).toBeUndefined();
	});

	it("builds compact server-owned character context", () => {
		const context = runtimeCharacterContext({ characterId: 6, language: "ru" });

		expect(context).toContain("## Character Context");
		expect(context).toContain("Grumpy Wizard");
		expect(context).toContain("ворчливый, но добрый волшебник");
		expect(context).toContain("Use the character only for tone");
	});
});
