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
});
