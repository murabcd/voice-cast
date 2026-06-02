import { describe, expect, it } from "vitest";
import {
	extractRussianSpokenNumber,
	parseRussianSpokenNumberPrefix,
} from "./russian-spoken-number.mjs";

describe("Russian spoken number parsing", () => {
	it("parses issue-style digit chunks from the beginning of a token list", () => {
		expect(
			parseRussianSpokenNumberPrefix(["сорок", "пять", "ноль", "семь"]),
		).toBe("4507");
		expect(
			parseRussianSpokenNumberPrefix(["восемьдесят", "пять", "ноль", "восемь"]),
		).toBe("8508");
	});

	it("parses normal spoken integers", () => {
		expect(
			extractRussianSpokenNumber("задача четыре тысячи пятьсот семь"),
		).toBe("4507");
	});

	it("does not scan past a non-number prefix in prefix mode", () => {
		expect(parseRussianSpokenNumberPrefix(["про", "сорок", "пять"])).toBe("");
	});
});
