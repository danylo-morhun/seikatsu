// Focus: what to work on across every project, in one list — late, today, already started,
// then the week ahead. Pure, so the page and its tests share it.

import type { Priority } from "@/features/seiryu/lib/constants";
import { addDays } from "@/features/seiryu/lib/filters";

export type FocusCard = {
	id: string;
	title: string;
	projectId: string;
	projectName: string;
	projectColor: string | null;
	columnId: string;
	/** Its lane is past the project's first one: work has started. */
	started: boolean;
	position: string;
	groupName: string | null;
	priority: Priority | null;
	dueDate: string | null;
	dueTime: string | null;
	repeats: boolean;
	/** ISO instant it last changed lane. */
	movedAt: string;
	checklist: { done: number; total: number } | null;
	/** The project's first finish lane, where Done sends it; null = the project has none. */
	doneColumnId: string | null;
};

export type FocusSectionKey = "overdue" | "today" | "doing" | "soon";

export type FocusSection = { key: FocusSectionKey; title: string; cards: FocusCard[] };

/** Days ahead the "Soon" section reaches. */
export const SOON_DAYS = 7;

const TITLES: Record<FocusSectionKey, string> = {
	overdue: "Overdue",
	today: "Today",
	doing: "In progress",
	soon: "Next 7 days",
};

const LEVEL: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const byWeight = (a: FocusCard, b: FocusCard) =>
	(a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
	(a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") ||
	(a.priority ? LEVEL[a.priority] : 4) - (b.priority ? LEVEL[b.priority] : 4) ||
	a.projectName.localeCompare(b.projectName) ||
	a.position.localeCompare(b.position);

/** Each card once, in the first section it fits; empty sections are left out. */
export function buildFocus(cards: FocusCard[], today: string): FocusSection[] {
	const soonEnd = addDays(today, SOON_DAYS);
	const sections: Record<FocusSectionKey, FocusCard[]> = {
		overdue: [],
		today: [],
		doing: [],
		soon: [],
	};
	for (const card of cards) {
		const due = card.dueDate;
		if (due && due < today) sections.overdue.push(card);
		else if (due === today) sections.today.push(card);
		else if (card.started) sections.doing.push(card);
		else if (due && due <= soonEnd) sections.soon.push(card);
	}
	return (Object.keys(sections) as FocusSectionKey[])
		.map((key) => ({ key, title: TITLES[key], cards: sections[key].sort(byWeight) }))
		.filter((s) => s.cards.length > 0);
}

/** Cards in Focus, for the project list's badge. */
export const focusCount = (sections: FocusSection[]) =>
	sections.reduce((n, s) => n + s.cards.length, 0);
