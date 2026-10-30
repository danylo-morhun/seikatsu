// Recurring dates, pure: safe to import from client components.

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export function advanceDate(dateStr: string, frequency: Frequency): string {
	const [y, m, d] = dateStr.split("-").map(Number);

	if (frequency === "daily" || frequency === "weekly") {
		const dt = new Date(y, m - 1, d);
		dt.setDate(dt.getDate() + (frequency === "daily" ? 1 : 7));
		return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
	}

	if (frequency === "monthly") {
		// next month in 0-indexed; wrap Dec→Jan
		const nm = m % 12; // 0-indexed next month (Jan=0)
		const ny = m === 12 ? y + 1 : y;
		const cap = new Date(ny, nm + 1, 0).getDate(); // last day of next month
		return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, cap)).padStart(2, "0")}`;
	}

	// yearly — clamp Feb 29 → Feb 28 in non-leap years
	const cap = new Date(y + 1, m, 0).getDate(); // last day of same month next year
	return `${y + 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, cap)).padStart(2, "0")}`;
}
