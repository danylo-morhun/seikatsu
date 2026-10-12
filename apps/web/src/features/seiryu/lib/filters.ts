import type { CardData } from "@/features/seiryu/lib/types";

export type DueFilter = "overdue" | "today" | "week" | "none";

export const DUE_FILTERS: { value: DueFilter; label: string }[] = [
	{ value: "overdue", label: "Overdue" },
	{ value: "today", label: "Due today" },
	{ value: "week", label: "Due this week" },
	{ value: "none", label: "No due date" },
];

export type Filters = { priorities: string[]; labelIds: string[]; due: DueFilter | "" };

const list = (value: string | null) => (value ?? "").split(",").filter(Boolean);

export function readFilters(params: URLSearchParams): Filters {
	const due = params.get("due") ?? "";
	return {
		priorities: list(params.get("priority")),
		labelIds: list(params.get("label")),
		due: DUE_FILTERS.some((d) => d.value === due) ? (due as DueFilter) : "",
	};
}

/** The filters as search params, keeping any other params as they are. */
export function writeFilters(params: URLSearchParams, filters: Filters) {
	const next = new URLSearchParams(params.toString());
	const set = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));
	set("priority", filters.priorities.join(","));
	set("label", filters.labelIds.join(","));
	set("due", filters.due);
	return next;
}

export const filterCount = (f: Filters) =>
	f.priorities.length + f.labelIds.length + (f.due ? 1 : 0);

/** YYYY-MM-DD strings compare in calendar order, so dates never need parsing here. */
export function addDays(ymd: string, days: number) {
	const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
	const date = new Date(Date.UTC(y, m - 1, d + days));
	return date.toISOString().slice(0, 10);
}

export function applyFilters(cards: CardData[], f: Filters, today: string): CardData[] {
	if (filterCount(f) === 0) return cards;
	const weekEnd = addDays(today, 7);
	return cards.filter((card) => {
		if (f.priorities.length > 0 && !f.priorities.includes(card.priority ?? "")) return false;
		if (f.labelIds.length > 0 && !card.labels.some((l) => f.labelIds.includes(l.id))) return false;
		if (!f.due) return true;
		if (f.due === "none") return card.dueDate === null;
		if (!card.dueDate) return false;
		if (f.due === "overdue") return card.dueDate < today;
		if (f.due === "today") return card.dueDate === today;
		return card.dueDate >= today && card.dueDate <= weekEnd;
	});
}
