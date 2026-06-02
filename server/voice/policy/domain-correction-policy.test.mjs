import { describe, expect, it } from "vitest";
import { correctSpokenDomainLabel } from "./domain-correction-policy.mjs";

describe("spoken domain correction policy", () => {
	it("keeps known STT domain corrections explicit and scoped", () => {
		expect(correctSpokenDomainLabel("flowny")).toBe("flomni");
		expect(correctSpokenDomainLabel("flomny")).toBe("flomni");
		expect(correctSpokenDomainLabel("example")).toBe("example");
	});
});
