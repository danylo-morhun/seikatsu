import { describe, expect, it } from "vitest";
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
