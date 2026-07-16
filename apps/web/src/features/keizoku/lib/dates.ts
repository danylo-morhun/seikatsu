/** Local YYYY-MM-DD — never toISOString(), which is UTC and can flip a day early/late by timezone. */
export function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse a YYYY-MM-DD string as a local Date, avoiding the UTC-midnight shift `new Date(str)` does. */
export function parseLocal(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
}
