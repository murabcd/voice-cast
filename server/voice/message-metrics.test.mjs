import { describe, expect, it } from "vitest";
import { measureMessages } from "./message-metrics.mjs";

describe("message metrics", () => {
	it("measures model context buckets", () => {
		const metrics = measureMessages([
			{ role: "system", content: "system" },
			{ role: "user", content: "hello" },
			{ role: "assistant", content: "reply" },
			{
				role: "user",
				content: 'prefix {"type":"tool_results","results":[]} suffix',
			},
		]);

		expect(metrics).toEqual({
			messages: 4,
			totalChars: 66,
			systemChars: 6,
			userChars: 5,
			assistantChars: 5,
			toolResultChars: 50,
		});
	});
});
