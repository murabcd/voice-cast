import { describe, expect, it } from "vitest";
import {
	callLocalDateTimeTool,
	selectLocalDateTimeTool,
} from "./local-date-time-tools.mjs";

const fixedNow = new Date("2026-06-01T16:00:00.000Z");

describe("local date time tools", () => {
	it("routes current time for requested city without web or LLM", () => {
		const selected = selectLocalDateTimeTool(
			"Сколько сейчас времени в Москве?",
		);
		expect(selected).toMatchObject({
			toolName: "current_time",
		});
		expect(
			callLocalDateTimeTool({
				toolName: selected.toolName,
				arguments: selected.arguments,
				now: fixedNow,
				language: "ru",
				timeZone: "America/New_York",
			}),
		).toMatchObject({
			reply: "В Москве сейчас 19:00.",
			result: { value: "19:00", timeZone: "Europe/Moscow" },
		});
	});

	it("uses user timezone when no city is requested", () => {
		const selected = selectLocalDateTimeTool("Сколько сейчас времени?");
		expect(
			callLocalDateTimeTool({
				toolName: selected.toolName,
				arguments: selected.arguments,
				now: fixedNow,
				language: "ru",
				timeZone: "America/New_York",
			}),
		).toMatchObject({
			reply: "У вас сейчас 12:00.",
		});
	});

	it("routes weekday questions", () => {
		const selected = selectLocalDateTimeTool(
			"Какой сегодня день недели в Москве?",
		);
		expect(
			callLocalDateTimeTool({
				toolName: selected.toolName,
				arguments: selected.arguments,
				now: fixedNow,
				language: "ru",
			}),
		).toMatchObject({
			reply: "В Москве сейчас понедельник.",
		});
	});

	it("does not route weather", () => {
		expect(
			selectLocalDateTimeTool("Какая сейчас погода в Москве?"),
		).toBeUndefined();
	});
});
