import { describe, expect, it } from "vitest";
import { DESIGN_SCRIPT, parseDesign } from "./design";

describe("parseDesign", () => {
	it("reads Classic only when asked for, Liquid Glass otherwise", () => {
		expect(parseDesign("classic")).toBe("classic");
		expect(parseDesign("glass")).toBe("glass");
		expect(parseDesign(undefined)).toBe("glass");
		expect(parseDesign("neon")).toBe("glass");
	});
});

describe("DESIGN_SCRIPT", () => {
	// The pre-paint script must agree with the server's reading of the same cookie.
	function run(cookie: string) {
		const document = { cookie, documentElement: { dataset: {} as Record<string, string> } };
		new Function("document", DESIGN_SCRIPT)(document);
		return document.documentElement.dataset.design;
	}

	it("sets the look from the cookie", () => {
		expect(run("design=classic")).toBe("classic");
		expect(run("tz=UTC; design=classic; sidebar_state=true")).toBe("classic");
		expect(run("design=glass")).toBe("glass");
		expect(run("")).toBe("glass");
	});

	it("doesn't mistake a longer cookie for the design one", () => {
		expect(run("old_design=classic")).toBe("glass");
		expect(run("design=classical")).toBe("glass");
	});
});
