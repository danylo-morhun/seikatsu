// Where a job is: an ISO 3166-1 alpha-2 code, shown as its English name.

const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });

/** An assigned country code ("PL"), not a made-up one; upper-cased, else null. */
export function toCountryCode(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const code = value.trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(code)) return null;
	// User-assigned (AA, QM–QZ, XA–XZ but Kosovo, ZZ), groupings (EU, UN) and the UK alias of GB.
	if (/^(AA|ZZ|EU|EZ|UN|UK|Q.)$/.test(code) || (code[0] === "X" && code !== "XK")) return null;
	return names.of(code) ? code : null;
}

/** Every country code, by English name: the picker's list. */
export const COUNTRY_CODES: readonly string[] = (() => {
	const codes: string[] = [];
	for (let a = 65; a <= 90; a++)
		for (let b = 65; b <= 90; b++) {
			const code = toCountryCode(String.fromCharCode(a, b));
			if (code) codes.push(code);
		}
	return codes.sort((x, y) => countryName(x).localeCompare(countryName(y)));
})();

/** What someone typed in the picker: a code ("pl") or a name ("poland", "UK"), else null. */
export function parseCountry(input: string): string | null {
	const text = input.trim().toLowerCase();
	if (!text) return null;
	const byCode = toCountryCode(text);
	if (byCode) return byCode;
	return (
		COUNTRY_CODES.find(
			(c) => countryName(c).toLowerCase() === text || countryLabel(c).toLowerCase() === text,
		) ?? null
	);
}

/** "Poland" for "PL"; the code itself if the runtime doesn't know it. */
export function countryName(code: string): string {
	return names.of(code) ?? code;
}

/** Short enough for a table cell: the long official names, trimmed. */
const SHORT: Record<string, string> = {
	US: "USA",
	GB: "UK",
	AE: "UAE",
	CZ: "Czechia",
	NL: "Netherlands",
};

export function countryLabel(code: string): string {
	return SHORT[code] ?? countryName(code);
}
