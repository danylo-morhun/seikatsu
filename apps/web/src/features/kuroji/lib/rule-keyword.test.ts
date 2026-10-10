import { describe, expect, it } from "vitest";
import { ruleKeyword } from "./rule-keyword";

const CARD = " —  TRANSAKCJA KARTĄ PŁATNICZĄ";

const cases: [string, string | null][] = [
	[`ROSSMANN 05 Kalisz${CARD}`, "ROSSMANN"],
	[`McDonalds 423 Strzegom Strzegom${CARD}`, "McDonalds"],
	[`DOBRY KLIMAT SP. ZOO ZABRZE${CARD}`, "DOBRY KLIMAT"],
	[`JMP S.A. BIEDRONKA 337 KATOWICE${CARD}`, "BIEDRONKA"],
	[`ANTHROPIC* CLAUDE SUB SAN FRANCISC${CARD}`, "ANTHROPIC"],
	[`GOOGLE*CLOUD 7S8HMM CC GOOGLE.CO${CARD}`, "GOOGLE"],
	[`APPLE.COM/BILL CORK${CARD}`, "APPLE.COM/BILL"],
	[`ELEGANT MESKI FRY64055 KALISZ${CARD}`, "ELEGANT MESKI"],
	[`3251 KALISZAMBER KALISZ${CARD}`, "KALISZAMBER"],
	[`PSS SKLEP NR 20 TECZA KALISZ${CARD}`, "PSS SKLEP"],
	[`Szczescie Istniej71760 Katowice${CARD}`, "Szczescie"],
	[`Infakt Sp. z o.o. krakow${CARD}`, "Infakt"],
	[`Zeccer Wroclaw${CARD}`, "Zeccer"],
	[`KAUFLAND 1161 KALISZ${CARD}`, "KAUFLAND"],
	[`8_KATOWICE_RYNEK Katowice${CARD}`, null],
	[
		"Volodymyr Voinov — Przelew na telefon 48793***898. Przelew na telefon REALIZACJA PŁATNOŚCI PEOPAY",
		"Volodymyr Voinov",
	],
	[
		"Zakład Ubezpieczeń Społecznych — Opłata składek NIP 6343067076 REALIZACJA PŁATNOŚCI PEOPAY",
		"Zakład Ubezpieczeń",
	],
	["v — Przelew na telefon 48731***051. REALIZACJA PŁATNOŚCI PEOPAY", null],
	["Avocado, peaches", "Avocado"],
	["Gym Membership", "Gym Membership"],
	["", null],
];

describe("ruleKeyword", () => {
	it.each(cases)("%s → %s", (description, keyword) => {
		expect(ruleKeyword(description)).toBe(keyword);
	});

	it("is always a piece of the description, so the rule matches it", () => {
		for (const [description] of cases) {
			const keyword = ruleKeyword(description);
			if (keyword) expect(description).toContain(keyword);
		}
		expect(ruleKeyword(`LUCA  BAKERY KATOWICE${CARD}`)).toBe("LUCA");
	});

	it("is null without a description", () => {
		expect(ruleKeyword(null)).toBeNull();
	});
});
