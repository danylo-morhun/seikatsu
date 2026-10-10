export type MonthTotals = { month: string; income: number; expenses: number };

export type FlowRow =
	| ({ kind: "month" } & MonthTotals)
	/** A run of months with no movement, oldest and newest month (YYYY-MM). */
	| { kind: "gap"; from: string; to: string };

/** Every month from `from` to `to` (YYYY-MM), oldest first. */
export function monthsBetween(from: string, to: string): string[] {
	const out: string[] = [];
	let [y, m] = from.split("-").map(Number);
	const [ty, tm] = to.split("-").map(Number);
	while (y < ty || (y === ty && m <= tm)) {
		out.push(`${y}-${String(m).padStart(2, "0")}`);
		m += 1;
		if (m > 12) {
			m = 1;
			y += 1;
		}
	}
	return out;
}

/**
 * Month rows for the range, newest first. Two or more empty months in a row fold into
 * one gap row, so a long range shows its activity, not a wall of zeros.
 */
export function flowRows(data: MonthTotals[], from: string, to: string): FlowRow[] {
	const byMonth = new Map(data.map((d) => [d.month.slice(0, 7), d]));
	const rows: FlowRow[] = [];
	let run: string[] = [];
	const flush = () => {
		if (run.length === 1) rows.push({ kind: "month", month: run[0], income: 0, expenses: 0 });
		if (run.length > 1) rows.push({ kind: "gap", from: run[run.length - 1], to: run[0] });
		run = [];
	};
	for (const month of monthsBetween(from, to).reverse()) {
		const d = byMonth.get(month);
		if (!d || (d.income === 0 && d.expenses === 0)) {
			run.push(month);
			continue;
		}
		flush();
		rows.push({ kind: "month", month, income: d.income, expenses: d.expenses });
	}
	flush();
	return rows;
}
