import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, countryLabel, parseCountry, toCountryCode } from "./country";

describe("toCountryCode", () => {
	it("takes assigned codes in any case", () => {
		expect(toCountryCode("pl")).toBe("PL");
		expect(toCountryCode(" UA ")).toBe("UA");
		expect(toCountryCode("XK")).toBe("XK");
	});

	it("drops what isn't a country", () => {
		for (const v of ["ZZ", "EU", "UN", "QQ", "XA", "POL", "", null, 42])
			expect(toCountryCode(v)).toBeNull();
	});
});

describe("parseCountry", () => {
	it("reads codes, names and short labels", () => {
		expect(parseCountry("de")).toBe("DE");
		expect(parseCountry("Poland")).toBe("PL");
		expect(parseCountry("uk")).toBe("GB");
		expect(parseCountry("Narnia")).toBeNull();
	});
});

it("lists about every country once", () => {
	expect(COUNTRY_CODES.length).toBeGreaterThan(240);
	expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
	expect(countryLabel("US")).toBe("USA");
});
