import { type MaintenanceDue, daysBetween } from "./due";

/** "170 100": narrow no-break spaces between thousands, as an odometer reads. */
export function formatNumber(n: number): string {
	return Math.round(n).toLocaleString("en-US").replace(/,/g, "\u202f");
}

export function formatKm(km: number): string {
	return `${formatNumber(km)} km`;
}

export function formatDate(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function formatDays(days: number): string {
	if (days === 0) return "today";
	const abs = Math.abs(days);
	const unit = abs >= 60 ? `${Math.round(abs / 30)} months` : abs === 1 ? "1 day" : `${abs} days`;
	return days < 0 ? `${unit} ago` : `in ${unit}`;
}

/** One line telling the owner what's left, e.g. "2 300 km or 4 months left". */
export function dueSummary(due: MaintenanceDue, today: string): string {
	if (due.status === "unknown") return "Log when it was last done";
	const parts: string[] = [];
	if (due.kmLeft != null) {
		parts.push(due.kmLeft <= 0 ? `${formatKm(-due.kmLeft)} over` : `${formatKm(due.kmLeft)} left`);
	}
	if (due.dueDate != null) {
		const days = daysBetween(today, due.dueDate);
		parts.push(days <= 0 ? `due ${formatDays(days)}` : `by ${formatDate(due.dueDate)}`);
	}
	return parts.join(" · ");
}

export function intervalSummary(intervalKm: number | null, intervalMonths: number | null): string {
	const parts: string[] = [];
	if (intervalKm != null) parts.push(`every ${formatKm(intervalKm)}`);
	if (intervalMonths != null) {
		parts.push(intervalMonths % 12 === 0 ? `${intervalMonths / 12} yr` : `${intervalMonths} mo`);
	}
	return parts.join(" / ");
}

/** "in 3 months", "today", "12 days ago": how far `iso` is from today. */
export function fromToday(iso: string, today: string): string {
	return formatDays(daysBetween(today, iso));
}

/** A km count with its sign, for a change: "+3 100 km". */
export function formatKmDelta(km: number): string {
	return `${km > 0 ? "+" : km < 0 ? "−" : ""}${formatKm(Math.abs(km))}`;
}

/** Money in the service's currency: "1 250,00 zł". */
export function formatMoney(amount: number, currency: string): string {
	return new Intl.NumberFormat("pl-PL", {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		useGrouping: "always",
		maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
		minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
	}).format(amount);
}

/** A typed number with spaces or a decimal comma ("167 000", "450,50"); blank or unreadable → null. */
export function parseNumber(text: string): number | null {
	const clean = text.replace(/[\s ']/g, "").replace(",", ".");
	if (clean === "") return null;
	const n = Number(clean);
	return Number.isFinite(n) ? n : null;
}
