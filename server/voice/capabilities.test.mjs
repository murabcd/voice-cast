import { describe, expect, it } from "vitest";
import {
	buildRuntimeCapabilities,
	capabilityReply,
	isCapabilityQuestion,
	runtimeCapabilityContext,
} from "./capabilities.mjs";

function registry({ web = true, tracker = true } = {}) {
	return {
		namespaces: [
			{
				name: "local_datetime",
				tools: [{ name: "current_time" }],
			},
			{
				name: "web",
				tools: web ? [{ name: "web_search" }, { name: "web_fetch" }] : [],
			},
			{
				name: "mcp",
				tools: tracker
					? [
							{ name: "yandex_tracker_get_issue" },
							{ name: "yandex_tracker_search" },
						]
					: [],
			},
		],
	};
}

describe("runtime capabilities", () => {
	it("detects capability questions in supported languages", () => {
		expect(isCapabilityQuestion("What can you do?")).toBe(true);
		expect(isCapabilityQuestion("Что ты умеешь?")).toBe(true);
		expect(isCapabilityQuestion("Can you send an email?")).toBe(true);
		expect(isCapabilityQuestion("Можешь отправить сообщение?")).toBe(true);
		expect(isCapabilityQuestion("Расскажи сказку")).toBe(false);
		expect(isCapabilityQuestion("Can you tell me a story?")).toBe(false);
		expect(isCapabilityQuestion("Can you check the weather?")).toBe(false);
	});

	it("builds capabilities from actual tool availability", () => {
		expect(
			buildRuntimeCapabilities({
				registry: registry(),
				settings: { language: "ru", webToolsEnabled: true },
				webTools: { enabled: true },
				mcpTools: { enabled: true },
			}),
		).toMatchObject({
			dateTime: true,
			language: "ru",
			tracker: true,
			webLookup: true,
			weather: true,
		});

		expect(
			buildRuntimeCapabilities({
				registry: registry({ web: false, tracker: false }),
				settings: { language: "en", webToolsEnabled: false },
				webTools: { enabled: true },
				mcpTools: { enabled: true },
			}),
		).toMatchObject({
			language: "en",
			tracker: false,
			webLookup: false,
			weather: false,
		});
	});

	it("describes unavailable capabilities in model context", () => {
		const context = runtimeCapabilityContext(
			buildRuntimeCapabilities({
				registry: registry({ web: false, tracker: false }),
				settings: { webToolsEnabled: false },
				webTools: { enabled: false },
				mcpTools: { enabled: false },
			}),
		);

		expect(context).toContain("Runtime Capabilities");
		expect(context).toContain("weather lookup");
		expect(context).toContain("Do not claim capabilities");
	});

	it("answers capability questions from runtime truth", () => {
		const reply = capabilityReply(
			buildRuntimeCapabilities({
				registry: registry({ web: false, tracker: true }),
				settings: { language: "en", webToolsEnabled: false },
				webTools: { enabled: false },
				mcpTools: { enabled: true },
			}),
		);

		expect(reply).toContain("read Yandex Tracker issues");
		expect(reply).not.toContain("look up current public information");
		expect(reply).toContain("cannot send messages");
	});
});
