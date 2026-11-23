import { describe, expect, it } from "vitest";
import { modulesOn } from "@/lib/modules";
import { DEFAULT_FEATURES, detailsFor, offFor, startingChoice } from "./welcome";

describe("offFor", () => {
	it("switches off whatever wasn't picked", () => {
		const off = offFor(["/kuroji", "/seiryu"], ["/week"]);
		const on = modulesOn(off);
		expect(on).toEqual(["/kuroji", "/seiryu", "/week"]);
	});

	it("drops Week plan along with Week", () => {
		expect(modulesOn(offFor(["/kuroji"], ["/week/plan"]))).toEqual(["/kuroji"]);
	});
});

describe("startingChoice", () => {
	it("starts a new user with no apps and the light defaults", () => {
		expect(startingChoice(null)).toEqual({ apps: [], features: DEFAULT_FEATURES });
	});

	it("starts again from what's on", () => {
		expect(startingChoice(["/kyuu", "/day"]).apps).not.toContain("/kyuu");
		expect(startingChoice(["/kyuu", "/day"]).features).toEqual(["/week", "/week/plan", "/goals"]);
	});
});

describe("detailsFor", () => {
	it("asks for a currency only while it can still change", () => {
		expect(detailsFor(["/kuroji"], true).currency).toBe(true);
		expect(detailsFor(["/kuroji"], false).currency).toBe(false);
		expect(detailsFor(["/tsundoku"], true)).toEqual({ currency: false, board: false });
		expect(detailsFor(["/seiryu"], false).board).toBe(true);
		expect(detailsFor(["/seiryu"], false, false).board).toBe(false);
	});
});
