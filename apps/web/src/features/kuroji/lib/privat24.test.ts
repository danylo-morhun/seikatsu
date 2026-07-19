import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { matchPrivat24Category, parsePrivat24Xlsx } from "./privat24";

// Builds a minimal in-memory .xlsx: a zip containing only the two parts
// parsePrivat24Xlsx actually reads (sharedStrings.xml + the first worksheet).
// Real Privat24 exports carry more xlsx boilerplate, but the parser never
// touches it, so the fixture skips it too.
function buildFixtureXlsx(): Uint8Array {
	const sharedStrings = [
		"Дата", // 0 — header marker the parser searches for
		"Ресторани, кафе, бари", // 1
		"4149 **** **** 4961", // 2
		"McDonalds", // 3
		"UAH", // 4
		"Супермаркети та продукти", // 5
		"Silpo", // 6
		"13.06.2026 20:32:58", // 7
		"12.06.2026 09:15:00", // 8
		"Виписка", // 9 — title-row text, distinct from the "Дата" header marker
	];

	const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map((s) => `<si><t>${s}</t></si>`).join("\n")}
</sst>`;

	const sCell = (ref: string, idx: number) => `<c r="${ref}" t="s"><v>${idx}</v></c>`;
	const nCell = (ref: string, value: number) => `<c r="${ref}"><v>${value}</v></c>`;

	const rows = [
		// Row 1: title row (ignored — header detection looks for "Дата" in col A)
		`<row r="1">${sCell("A1", 9)}</row>`,
		// Row 2: header row — col A must resolve to "Дата"
		`<row r="2">${sCell("A2", 0)}</row>`,
		// Row 3: newest data row — McDonald's, restaurant category, -150.5 UAH
		`<row r="3">${sCell("A3", 7)}${sCell("B3", 1)}${sCell("C3", 2)}${sCell("D3", 3)}${nCell("E3", -150.5)}${sCell("F3", 4)}${nCell("I3", 9849.5)}</row>`,
		// Row 4: older data row — Silpo, groceries category, -300 UAH
		`<row r="4">${sCell("A4", 8)}${sCell("B4", 5)}${sCell("C4", 2)}${sCell("D4", 6)}${nCell("E4", -300)}${sCell("F4", 4)}${nCell("I4", 10000)}</row>`,
	];

	const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
${rows.join("\n")}
</sheetData>
</worksheet>`;

	return zipSync({
		"xl/sharedStrings.xml": strToU8(sharedStringsXml),
		"xl/worksheets/sheet1.xml": strToU8(sheetXml),
	});
}

describe("parsePrivat24Xlsx", () => {
	const statement = parsePrivat24Xlsx(buildFixtureXlsx());

	it("parses shared strings and sheet rows into statement rows", () => {
		expect(statement.rows).toHaveLength(2);

		const [newest, older] = statement.rows;
		expect(newest.date).toBe("2026-06-13");
		expect(newest.description).toBe("McDonalds");
		expect(newest.category).toBe("Ресторани, кафе, бари");
		expect(newest.cardMask).toBe("4149 **** **** 4961");
		expect(newest.amount).toBe(-150.5);
		expect(newest.currency).toBe("UAH");
		expect(newest.runningBalance).toBe(9849.5);

		expect(older.date).toBe("2026-06-12");
		expect(older.description).toBe("Silpo");
		expect(older.amount).toBe(-300);
	});

	it("derives card currency, card mask and closing balance from the newest row", () => {
		expect(statement.cardCurrency).toBe("UAH");
		expect(statement.cardMask).toBe("4149 **** **** 4961");
		expect(statement.closingBalance).toBe(9849.5);
	});

	it("throws on a buffer that isn't a valid zip", () => {
		expect(() => parsePrivat24Xlsx(new Uint8Array([1, 2, 3]))).toThrow("Not a valid .xlsx file");
	});
});

describe("matchPrivat24Category", () => {
	it("matches a known Privat24 category to a candidate account by synonym", () => {
		const candidates = [
			{ id: "acc-groceries", name: "Groceries" },
			{ id: "acc-transport", name: "Transport" },
		];
		expect(matchPrivat24Category("Супермаркети та продукти", candidates)).toBe("acc-groceries");
	});

	it("returns null when nothing lines up", () => {
		const candidates = [{ id: "acc-transport", name: "Transport" }];
		expect(matchPrivat24Category("Супермаркети та продукти", candidates)).toBeNull();
	});
});
