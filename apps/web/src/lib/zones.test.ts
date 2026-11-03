import { describe, expect, it } from "vitest";
import { APPS_CONFIG } from "./app-themes";
import { getZoneForApp, ZONES } from "./zones";

describe("zones", () => {
	it("puts every app in exactly one zone", () => {
		const zoned = ZONES.flatMap((zone) => zone.apps as readonly string[]);
		expect([...zoned].sort()).toEqual(Object.keys(APPS_CONFIG).sort());
	});

	it("finds an app's zone", () => {
		expect(getZoneForApp("/hoshii")?.id).toBe("money");
		expect(getZoneForApp("/aisha")?.id).toBe("do");
		expect(getZoneForApp("/nope")).toBeNull();
	});
});
