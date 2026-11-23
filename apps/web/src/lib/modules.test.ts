import { describe, expect, it } from "vitest";
import { MODULE_HREFS, moduleOfPath, moduleOfTool, modulesOn, pathIsOn } from "./modules";

describe("modulesOn", () => {
	it("is everything when nothing is off", () => {
		expect(modulesOn([])).toEqual(MODULE_HREFS);
	});

	it("drops what's off, and a feature whose base is off", () => {
		const on = modulesOn(["/kyuu", "/week"]);
		expect(on).not.toContain("/kyuu");
		expect(on).not.toContain("/week");
		expect(on).not.toContain("/week/plan");
		expect(on).toContain("/day");
	});

	it("ignores what it doesn't know", () => {
		expect(modulesOn(["/trips"])).toEqual(MODULE_HREFS);
	});
});

describe("moduleOfPath", () => {
	it("names the module a page belongs to", () => {
		expect(moduleOfPath("/morning")).toBe("/day");
		expect(moduleOfPath("/evening?x=1")).toBe("/day");
		expect(moduleOfPath("/week")).toBe("/week");
		expect(moduleOfPath("/week/plan")).toBe("/week/plan");
		expect(moduleOfPath("/kuroji/accounts/1")).toBe("/kuroji");
		expect(moduleOfPath("/")).toBeNull();
		expect(moduleOfPath("/settings")).toBeNull();
		expect(moduleOfPath("/kurojix")).toBeNull();
	});

	it("keeps a page of a module that's off out of reach", () => {
		const on = modulesOn(["/goals"]);
		expect(pathIsOn("/goals", on)).toBe(false);
		expect(pathIsOn("/apps", on)).toBe(true);
	});
});

describe("moduleOfTool", () => {
	it("maps MCP tools by name", () => {
		expect(moduleOfTool("today")).toBeNull();
		expect(moduleOfTool("week")).toBe("/week");
		expect(moduleOfTool("week_set_focus")).toBe("/week/plan");
		expect(moduleOfTool("day_close")).toBe("/day");
		expect(moduleOfTool("kuroji_add_transaction")).toBe("/kuroji");
		expect(moduleOfTool("goals")).toBe("/goals");
	});
});
