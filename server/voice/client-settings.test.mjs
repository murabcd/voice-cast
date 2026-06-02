import { describe, expect, it } from "vitest";
import { parseClientSettingsMessage } from "./client-settings.mjs";

describe("client settings", () => {
	it("enables auto greeting unless the client explicitly disables it", () => {
		expect(parseClientSettingsMessage({}).settings.autoGreetingEnabled).toBe(
			true,
		);
		expect(
			parseClientSettingsMessage({ autoGreetingEnabled: true }).settings
				.autoGreetingEnabled,
		).toBe(true);
		expect(
			parseClientSettingsMessage({ autoGreetingEnabled: false }).settings
				.autoGreetingEnabled,
		).toBe(false);
	});

	it("accepts only server-known character ids", () => {
		expect(
			parseClientSettingsMessage({ characterId: 6 }).settings.characterId,
		).toBe(6);
		expect(
			parseClientSettingsMessage({ characterId: 999 }).settings.characterId,
		).toBeUndefined();
	});

	it("uses the base system prompt field instead of runtime prompt blobs", () => {
		const parsed = parseClientSettingsMessage({
			baseSystemPrompt: "Base voice behavior.",
			systemPrompt: "Browser-composed runtime prompt.",
		});

		expect(parsed.settings.systemPrompt).toBe("Base voice behavior.");
	});
});
