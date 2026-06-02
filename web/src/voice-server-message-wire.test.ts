import { describe, expect, it } from "vitest";
import { parseVoiceServerMessage } from "./voice-server-message-wire";

describe("voice server message wire", () => {
	it("accepts known state messages with valid phases", () => {
		expect(
			parseVoiceServerMessage(
				JSON.stringify({ type: "state", phase: "hearing" }),
			),
		).toEqual({ type: "state", phase: "hearing" });
	});

	it("rejects malformed JSON, unknown message types, and invalid phases", () => {
		expect(parseVoiceServerMessage("{")).toBeUndefined();
		expect(
			parseVoiceServerMessage(JSON.stringify({ type: "unknown" })),
		).toBeUndefined();
		expect(
			parseVoiceServerMessage(JSON.stringify({ type: "state", phase: "lost" })),
		).toBeUndefined();
	});

	it("validates character handoff ids before the UI switches avatars", () => {
		expect(
			parseVoiceServerMessage(
				JSON.stringify({ type: "character_handoff", characterId: 5 }),
			),
		).toMatchObject({ type: "character_handoff", characterId: 5 });
		expect(
			parseVoiceServerMessage(
				JSON.stringify({ type: "character_handoff", characterId: "5" }),
			),
		).toBeUndefined();
	});
});
