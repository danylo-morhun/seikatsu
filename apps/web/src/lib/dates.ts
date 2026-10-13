// Calendar days as YYYY-MM-DD strings. Not a "use server" module.

/** A YYYY-MM-DD day at local midnight (`new Date(str)` would be UTC and shift it a day). */
export function parseLocal(str: string): Date {
	const [y, m, d] = str.split("-").map(Number);
	return new Date(y, m - 1, d);
}
