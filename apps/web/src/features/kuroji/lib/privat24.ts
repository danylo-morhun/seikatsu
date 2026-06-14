// Parser for Privat24 personal-card statement exports (.xlsx).
//
// PrivatBank closed its personal-card REST API (p24api / rest_fiz) in 2023, so
// there is no live endpoint to sync from. The only path for an individual card
// is the statement file the Privat24 app exports ("Історія операцій"). This
// reads that file directly — an .xlsx is a zip of XML, so we unzip with fflate
// and parse the two sheets we need (sharedStrings + the first worksheet).
//
// Expected columns (row 1 = title, row 2 = header, row 3+ = data):
//   A Дата                          "13.06.2026 20:32:58"  (DD.MM.YYYY HH:MM:SS)
//   B Категорія                     "Ресторани, кафе, бари"
//   C Картка                        "4149 **** **** 4961"
//   D Опис операції                 "McDonald’s"
//   E Сума в валюті картки          signed number (− = outflow)
//   F Валюта картки                 "UAH"
//   G Сума в валюті транзакції       number (foreign-currency amount, unsigned)
//   H Валюта транзакції             "PLN"
//   I Залишок на кінець періоду      running balance after this row
//   J Валюта залишку                "UAH"
//
// Rows are newest-first.

import { strFromU8, unzipSync } from "fflate";

export type Privat24Row = {
	dateTime: string; // raw "DD.MM.YYYY HH:MM:SS"
	date: string; // ISO "YYYY-MM-DD"
	category: string;
	cardMask: string;
	description: string;
	amount: number; // signed, in card currency
	currency: string; // card currency
	txnAmount: number | null; // foreign-currency amount, if different
	txnCurrency: string | null;
	runningBalance: number | null;
};

export type Privat24Statement = {
	rows: Privat24Row[];
	cardCurrency: string | null;
	cardMask: string | null;
	// Balance after the newest row (= balance at end of statement period).
	closingBalance: number | null;
};

// ── XML helpers ──────────────────────────────────────────────────────────────

// Decode the XML entities Excel writes into text nodes.
function decodeXml(s: string): string {
	return s
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number.parseInt(d, 10)))
		.replace(/&amp;/g, "&"); // last, so "&amp;lt;" → "&lt;"
}

// Parse <sst> shared strings into an index→value array. Each <si> may hold a
// single <t> or several <r><t> runs (rich text); we concatenate all <t> nodes.
function parseSharedStrings(xml: string): string[] {
	const out: string[] = [];
	const siRe = /<si>([\s\S]*?)<\/si>/g;
	let m: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
	while ((m = siRe.exec(xml)) !== null) {
		const inner = m[1];
		const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
		let parts = "";
		let t: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
		while ((t = tRe.exec(inner)) !== null) parts += t[1];
		// Self-closing <t/> (empty string) leaves parts = "".
		out.push(decodeXml(parts));
	}
	return out;
}

type Cell = { col: string; type: string | null; value: string };

// Parse worksheet rows into arrays of cells keyed by column letter.
function parseSheetRows(xml: string): Cell[][] {
	const rows: Cell[][] = [];
	const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
	let r: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
	while ((r = rowRe.exec(xml)) !== null) {
		const cells: Cell[] = [];
		const cellRe = /<c r="([A-Z]+)\d+"(?:[^>]*?\st="([^"]+)")?[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g;
		let c: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
		while ((c = cellRe.exec(r[1])) !== null) {
			const body = c[3] ?? "";
			const vMatch = body.match(/<v>([\s\S]*?)<\/v>/);
			cells.push({ col: c[1], type: c[2] ?? null, value: vMatch ? vMatch[1] : "" });
		}
		rows.push(cells);
	}
	return rows;
}

// ── Cell resolution ────────────────────────────────────────────────────────

function cellText(cells: Cell[], col: string, shared: string[]): string {
	const cell = cells.find((c) => c.col === col);
	if (!cell || cell.value === "") return "";
	if (cell.type === "s") {
		const idx = Number(cell.value);
		return shared[idx] ?? "";
	}
	if (cell.type === "inlineStr") return decodeXml(cell.value);
	return cell.value;
}

function cellNumber(cells: Cell[], col: string): number | null {
	const cell = cells.find((c) => c.col === col);
	if (!cell || cell.value === "" || cell.type === "s") return null;
	const n = Number(cell.value);
	return Number.isFinite(n) ? n : null;
}

// "13.06.2026 20:32:58" → "2026-06-13" (null if unparseable).
export function privat24IsoDate(raw: string): string | null {
	const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
	if (!m) return null;
	return `${m[3]}-${m[2]}-${m[1]}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function parsePrivat24Xlsx(buf: Uint8Array): Privat24Statement {
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(buf);
	} catch {
		throw new Error("Not a valid .xlsx file");
	}

	const ssFile = files["xl/sharedStrings.xml"];
	const shared = ssFile ? parseSharedStrings(strFromU8(ssFile)) : [];

	// First worksheet — Privat24 exports a single sheet.
	const sheetKey = Object.keys(files).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
	if (!sheetKey) throw new Error("No worksheet found in file");
	const sheetRows = parseSheetRows(strFromU8(files[sheetKey]));

	// Locate the header row (the one containing "Дата" in column A). Data starts
	// on the next row. Defaults to row index 1 (0-based) if not found.
	let headerIdx = sheetRows.findIndex((cells) => cellText(cells, "A", shared).trim() === "Дата");
	if (headerIdx === -1) headerIdx = 1;

	const rows: Privat24Row[] = [];
	for (let i = headerIdx + 1; i < sheetRows.length; i++) {
		const cells = sheetRows[i];
		const dateTime = cellText(cells, "A", shared).trim();
		const date = privat24IsoDate(dateTime);
		const amount = cellNumber(cells, "E");
		// A data row must have a parseable date and a card-currency amount.
		if (!date || amount === null) continue;

		const txnCurrency = cellText(cells, "H", shared).trim() || null;
		rows.push({
			dateTime,
			date,
			category: cellText(cells, "B", shared).trim(),
			cardMask: cellText(cells, "C", shared).trim(),
			description: cellText(cells, "D", shared).trim(),
			amount,
			currency: cellText(cells, "F", shared).trim() || "UAH",
			txnAmount: cellNumber(cells, "G"),
			txnCurrency,
			runningBalance: cellNumber(cells, "I"),
		});
	}

	const cardCurrency = rows.find((r) => r.currency)?.currency ?? null;
	const cardMask = rows.find((r) => r.cardMask)?.cardMask ?? null;
	// Rows are newest-first → the first row's running balance is the closing one.
	const closingBalance = rows.find((r) => r.runningBalance !== null)?.runningBalance ?? null;

	return { rows, cardCurrency, cardMask, closingBalance };
}

// Synthetic, stable, unique id for dedupe. Privat24 exports carry no reference,
// but each row's running balance is distinct, so it disambiguates otherwise
// identical operations while staying stable across re-imports of the same file.
export function privat24ExternalId(row: Privat24Row, accountId: string): string {
	return `p24:${accountId}:${row.dateTime}:${row.amount}:${row.runningBalance ?? ""}`;
}

// Fold the bank's category into the description so keyword import-rules can
// match on either, and the user sees a meaningful label.
export function privat24Description(row: Privat24Row): string {
	const parts = [row.description, row.category].map((s) => s.trim()).filter(Boolean);
	const base = parts.join(" — ") || "Privat24 transaction";
	// Note the original foreign-currency amount when it differs from the card one.
	if (row.txnCurrency && row.txnCurrency !== row.currency && row.txnAmount !== null) {
		return `${base} (${row.txnAmount} ${row.txnCurrency})`;
	}
	return base;
}

// E column is signed: positive = money in (inflow), negative = money out.
export function privat24IsInflow(row: Privat24Row): boolean {
	return row.amount > 0;
}

// ── Category matching ────────────────────────────────────────────────────────
//
// Privat24 tags every operation with a Ukrainian category. Map each to the
// English/transliterated terms a user is likely to have named their Kuroji
// category accounts with, so imports land in the right account automatically.
// Terms are matched (case-insensitive, substring, either direction) against the
// user's INCOME/EXPENSE account names — the first hit wins.
export const PRIVAT24_CATEGORY_MAP: Record<string, string[]> = {
	"супермаркети та продукти": ["groceries", "supermarket", "food", "продукти"],
	продукти: ["groceries", "supermarket", "food"],
	"ресторани, кафе, бари": ["restaurant", "cafe", "dining", "eating out", "bars"],
	"кафе, бари, ресторани": ["restaurant", "cafe", "dining", "eating out", "bars"],
	"кафе та ресторани": ["restaurant", "cafe", "dining", "eating out"],
	транспорт: ["transport", "transit", "travel"],
	таксі: ["taxi", "ride", "transport"],
	азс: ["fuel", "gas", "petrol", "gasoline"],
	заправки: ["fuel", "gas", "petrol", "gasoline"],
	авто: ["car", "auto", "vehicle"],
	краса: ["beauty", "cosmetics", "personal care"],
	"здоров'я": ["health", "medical", "pharmacy", "medicine"],
	"аптеки, медицина": ["pharmacy", "health", "medical", "medicine"],
	аптеки: ["pharmacy", "health", "medicine"],
	"одяг та взуття": ["clothes", "clothing", "apparel", "shoes", "fashion"],
	одяг: ["clothes", "clothing", "apparel", "fashion"],
	розваги: ["entertainment", "fun", "leisure"],
	"комунальні платежі": ["utilities", "bills", "communal"],
	комуналка: ["utilities", "bills"],
	"зв'язок": ["communication", "phone", "mobile", "internet"],
	"зв'язок, інтернет": ["communication", "internet", "mobile", "phone"],
	інтернет: ["internet", "communication"],
	подорожі: ["travel", "trips", "vacation", "holiday"],
	перекази: ["transfer", "transfers"],
	поповнення: ["top up", "deposit", "income", "salary"],
	"зняття готівки": ["cash", "withdrawal", "atm"],
	спорт: ["sport", "fitness", "gym"],
	електроніка: ["electronics", "gadgets", "tech"],
	техніка: ["electronics", "appliances", "tech"],
	тварини: ["pets", "animals"],
	діти: ["kids", "children", "baby"],
	освіта: ["education", "courses", "learning", "school"],
	книги: ["books", "reading"],
	подарунки: ["gifts", "presents"],
	"дім, ремонт": ["home", "repair", "household", "furniture"],
	дім: ["home", "household"],
	податки: ["tax", "taxes"],
	страхування: ["insurance"],
	зарплата: ["salary", "income", "wage", "payroll"],
	інше: ["other", "misc", "miscellaneous"],
};

// Resolve a Privat24 category to one of the candidate accounts (already filtered
// to the right side — INCOME for inflow, EXPENSE for outflow). Returns the
// matched account id, or null if no account name lines up with the category.
export function matchPrivat24Category(
	category: string,
	candidates: { id: string; name: string }[],
): string | null {
	const cat = category.trim().toLowerCase();
	if (!cat || candidates.length === 0) return null;

	// Candidate match terms: the raw Ukrainian category plus its mapped synonyms.
	const terms = [cat, ...(PRIVAT24_CATEGORY_MAP[cat] ?? [])].filter((t) => t.length >= 3);

	for (const term of terms) {
		const hit = candidates.find((c) => {
			const name = c.name.trim().toLowerCase();
			if (name.length < 3) return false;
			return name === term || name.includes(term) || term.includes(name);
		});
		if (hit) return hit.id;
	}
	return null;
}
