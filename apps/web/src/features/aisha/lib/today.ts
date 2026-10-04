/** Local YYYY-MM-DD — never toISOString(), which is UTC and can flip the day near midnight. */
export function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
