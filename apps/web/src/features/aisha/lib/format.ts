import { type MaintenanceDue, daysBetween } from "./due";

export function formatKm(km: number): string {
	return `${km.toLocaleString("en-US").replace(/,/g, " ")} km`;
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
