import { describe, expect, it } from "vitest";
import { modulesOn } from "./modules";
import { matchPlaces } from "./places";

describe("matchPlaces", () => {
	it("finds an app by the start of its name, then its sections", () => {
		expect(matchPlaces("kur").map((p) => p.href)[0]).toBe("/kuroji");
		expect(matchPlaces("plan").map((p) => p.name)).toContain("Kuroji · Plan");
		expect(matchPlaces("week")[0]).toMatchObject({ href: "/week", name: "Week" });
	});

	it("leaves lines with amounts or long ones to capture", () => {
		expect(matchPlaces("lunch 45")).toEqual([]);
		expect(matchPlaces("k")).toEqual([]);
		expect(matchPlaces("bought a new phone case at the mall yesterday")).toEqual([]);
	});
});

describe("matchPlaces with modules off", () => {
	it("leaves out the places, and settings, of a module that's off", () => {
		const on = modulesOn(["/kuroji", "/goals"]);
		const names = matchPlaces("kur", 5, on).map((p) => p.name);
		expect(names).toEqual([]);
		expect(matchPlaces("goals", 5, on)).toEqual([]);
		expect(matchPlaces("week", 5, on)[0]?.href).toBe("/week");
	});
});
