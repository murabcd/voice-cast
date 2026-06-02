import { describe, expect, it } from "vitest";
import { buildVoiceToolRegistry } from "../ai/tools/tool-registry.mjs";
import {
	buildRuntimeCapabilities,
	capabilityReply,
	isCapabilityQuestion,
	runtimeCapabilityContext,
} from "./capabilities.mjs";
import { selectToolsForTurn } from "./tool-selector.mjs";

function toolRegistry({ webEnabled = true, webToolsAvailable = true } = {}) {
	return buildVoiceToolRegistry({
		settings: {
			language: "ru",
			timeZone: "Europe/Moscow",
			webToolsEnabled: webEnabled,
		},
		webTools: {
			enabled: webToolsAvailable,
			tools: webToolsAvailable
				? [
						{ name: "web_search", description: "search", parameters: {} },
						{ name: "web_fetch", description: "fetch", parameters: {} },
					]
				: [],
			callTool: async () => ({}),
		},
		mcpTools: {
			enabled: false,
			tools: [],
			callTool: async () => ({}),
		},
	});
}

function capabilities({ language = "ru", webEnabled = true } = {}) {
	const registry = toolRegistry({
		webEnabled,
		webToolsAvailable: webEnabled,
	});
	return buildRuntimeCapabilities({
		registry,
		settings: { language, webToolsEnabled: webEnabled },
		webTools: { enabled: webEnabled },
		mcpTools: { enabled: false },
	});
}

describe("capability hallucination evals", () => {
	it("answers broad capability questions from runtime truth", () => {
		const reply = capabilityReply(capabilities({ language: "ru" }));

		expect(isCapabilityQuestion("Что ты умеешь?")).toBe(true);
		expect(reply).toContain("искать актуальную публичную информацию");
		expect(reply).not.toContain("Яндекс Трекере");
		expect(reply).toContain("не могу отправлять сообщения");
	});

	it("does not route real weather requests to the capability shortcut", () => {
		const registry = toolRegistry({ webEnabled: true });

		expect(isCapabilityQuestion("Можешь посмотреть погоду в Москве?")).toBe(
			false,
		);
		expect(
			selectToolsForTurn({
				text: "Можешь посмотреть погоду в Москве?",
				registry,
				webToolsEnabled: true,
			}),
		).toMatchObject({
			kind: "direct_web",
			toolNames: ["web_search"],
		});
	});

	it("marks weather unavailable when web lookup is disabled", () => {
		const context = runtimeCapabilityContext(
			capabilities({ webEnabled: false }),
		);

		expect(context).toContain("weather lookup");
		expect(context).toContain("Do not claim capabilities");
	});

	it("handles unsupported send-email requests as capability questions", () => {
		const reply = capabilityReply(capabilities({ language: "en" }));

		expect(isCapabilityQuestion("Can you send an email?")).toBe(true);
		expect(reply).toContain("cannot send messages");
		expect(reply).not.toContain("Sure");
	});
});
