import { describe, expect, it } from "vitest";
import { isWebToolName, toolProvider } from "./tool-provider.mjs";

describe("tool provider", () => {
	it("resolves server-owned tool providers from tool names", () => {
		expect(toolProvider("web_search")).toBe("web");
		expect(toolProvider("web_fetch")).toBe("web");
		expect(toolProvider("yandex_tracker_get_issue")).toBe("yandex-tracker");
		expect(toolProvider("files__read")).toBeUndefined();
	});

	it("keeps web tool checks behind a named helper", () => {
		expect(isWebToolName("web_search")).toBe(true);
		expect(isWebToolName("yandex_tracker_search")).toBe(false);
	});
});
