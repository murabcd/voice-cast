import { describe, expect, it } from "vitest";
import { createBargeInDetector } from "./barge-in-detector";

describe("barge-in detector", () => {
	it("holds mic frames during assistant audio until speech crosses the threshold", () => {
		let now = 1000;
		const detector = createBargeInDetector({
			framesRequired: 2,
			releaseMs: 800,
			rmsThreshold: 0.5,
			now: () => now,
		});

		expect(
			detector.evaluate({ assistantActive: true, rms: 0.7 }),
		).toMatchObject({
			allowMicFrame: false,
			shouldSendBargeIn: false,
		});
		expect(
			detector.evaluate({ assistantActive: true, rms: 0.8 }),
		).toMatchObject({
			allowMicFrame: false,
			shouldCancelPlayback: true,
			shouldSendBargeIn: true,
		});

		now = 1700;
		expect(
			detector.evaluate({ assistantActive: false, rms: 0.1 }),
		).toMatchObject({ allowMicFrame: false });

		now = 1800;
		expect(
			detector.evaluate({ assistantActive: false, rms: 0.1 }),
		).toMatchObject({ allowMicFrame: true });
	});
});
