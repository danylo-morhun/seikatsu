import { describe, expect, it } from "vitest";
import { APPS_CONFIG } from "./app-themes";
import { getZoneForApp, getZoneForPath, ZONES } from "./zones";

describe("zones", () => {
	it("puts every app in exactly one zone", () => {
		const zoned = ZONES.flatMap((zone) => zone.apps as readonly string[]);
		expect([...zoned].sort()).toEqual(Object.keys(APPS_CONFIG).sort());
	});

	it("gives no zone a page an app already owns", () => {
		for (const zone of ZONES) {
			expect(Object.keys(APPS_CONFIG).some((app) => zone.href.startsWith(app))).toBe(false);
		}
	});

	it("finds an app's zone", () => {
		expect(getZoneForApp("/hoshii")?.id).toBe("money");
		expect(getZoneForApp("/aisha")?.id).toBe("do");
		expect(getZoneForApp("/nope")).toBeNull();
	});

	it("finds a page's zone", () => {
		expect(getZoneForPath("/do")?.id).toBe("do");
		expect(getZoneForPath("/kuroji/accounts/1")?.id).toBe("money");
		expect(getZoneForPath("/tsundoku")?.id).toBe("life");
		expect(getZoneForPath("/download")).toBeNull();
		expect(getZoneForPath("/settings/kuroji")).toBeNull();
		expect(getZoneForPath("/")).toBeNull();
	});
});
