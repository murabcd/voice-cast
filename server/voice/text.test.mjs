import { describe, expect, it } from "vitest";
import {
	cleanLlmText,
	createSentenceChunker,
	stripLlmArtifacts,
} from "./text.mjs";

describe("voice text cleanup", () => {
	it("removes thinking blocks and no-think markers", () => {
		expect(stripLlmArtifacts("<think>draft</think>Привет. /no_think")).toBe(
			"Привет. ",
		);
	});

	it("removes markdown links and bare urls from spoken text", () => {
		expect(
			cleanLlmText(
				"1. [Lenta.ru](https://lenta.ru/) сообщает новость. Подробнее: https://example.com/a.",
			),
		).toBe("1. Lenta.ru сообщает новость.");
	});

	it("keeps spoken text complete for TTS", () => {
		expect(cleanLlmText("Здравствуйте, чем помочь")).toBe(
			"Здравствуйте, чем помочь.",
		);
	});

	it("chunks finished sentences while keeping partial text buffered", () => {
		const chunker = createSentenceChunker();

		expect(chunker.push("Первое предложение. Втор")).toEqual([
			"Первое предложение.",
		]);
		expect(chunker.push("ое предложение!")).toEqual(["Второе предложение!"]);
		expect(chunker.flush()).toEqual([]);
	});
});
