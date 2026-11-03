// What a zone waits on: one list across its apps, most urgent first. Pure — the zone page
// loads each app's summary (features/home/lib/today) and hands them in.

import type {
	BookToday,
	CardToday,
	CarToday,
	HabitToday,
	JobsToday,
	WantsToday,
} from "@/features/home/lib/today";
import type { APPS_CONFIG } from "@/lib/app-themes";
import type { ZoneId } from "@/lib/zones";

type AppHref = keyof typeof APPS_CONFIG;

export type QueueTone = "overdue" | "due" | "info";

export type QueueItem = {
	key: string;
	app: AppHref;
	title: string;
	note: string;
	href: string;
	tone: QueueTone;
};

/** Each app's summary as the home loads it; null when it couldn't be read or isn't set up. */
export type ZoneData = {
	captures?: number | null;
	wants?: WantsToday | null;
	cards?: CardToday[] | null;
	habits?: { habits: HabitToday[] } | null;
	jobs?: JobsToday | null;
	car?: CarToday | null;
	reading?: BookToday[] | null;
};

const TONE_ORDER: Record<QueueTone, number> = { overdue: 0, due: 1, info: 2 };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function daysLate(dueDate: string, today: string) {
	return Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000);
}

function moneyItems(data: ZoneData): QueueItem[] {
	const items: QueueItem[] = [];
	const captures = data.captures ?? 0;
	if (captures > 0)
		items.push({
			key: "kuroji:captures",
			app: "/kuroji",
			title: `${plural(captures, "payment")} to add`,
			note: "Apple Pay captures waiting in Kuroji",
			href: "/kuroji",
			tone: "due",
		});
	const wants = data.wants;
	if (wants && wants.decide > 0)
		items.push({
			key: "hoshii:decide",
			app: "/hoshii",
			title: `${plural(wants.decide, "want")} to decide`,
			note: "Cooled down: keep it or let it go",
			href: "/hoshii",
			tone: "due",
		});
	if (wants && wants.canBuy > 0)
		items.push({
			key: "hoshii:buy",
			app: "/hoshii",
			title: wants.nextBuy ? `Can buy ${wants.nextBuy}` : `${plural(wants.canBuy, "want")} funded`,
			note: wants.canBuy > 1 ? `${wants.canBuy} wants fully funded` : "Fully funded by the piggy",
			href: "/hoshii",
			tone: "info",
		});
	return items;
}

/** How far off (or past) the car's next service is, by distance when it has one. */
function carWhen(next: NonNullable<CarToday["next"]>): string {
	const late = next.status === "overdue";
	if (next.kmLeft != null) {
		const km = `${Math.abs(next.kmLeft).toLocaleString("en-US")} km`;
		return late ? `${km} overdue` : `in ${km}`;
	}
	if (next.daysLeft != null) {
		const days = plural(Math.abs(next.daysLeft), "day");
		return late ? `${days} overdue` : `in ${days}`;
	}
	return late ? "overdue" : "soon";
}

function doItems(data: ZoneData, today: string): QueueItem[] {
	const items: QueueItem[] = [];
	for (const card of data.cards ?? []) {
		const late = daysLate(card.dueDate, today);
		items.push({
			key: `seiryu:${card.id}`,
			app: "/seiryu",
			title: card.title,
			note:
				late > 0
					? `${card.projectName} · ${plural(late, "day")} overdue`
					: `${card.projectName} · due today`,
			href: `/seiryu/${card.projectId}/${card.id}`,
			tone: late > 0 ? "overdue" : "due",
		});
	}
	const left = (data.habits?.habits ?? []).filter((h) => !h.done);
	if (left.length > 0)
		items.push({
			key: "keizoku:left",
			app: "/keizoku",
			title: `${plural(left.length, "habit")} left today`,
			note: left.map((h) => h.name).join(", "),
			href: "/keizoku",
			tone: "due",
		});
	const jobs = data.jobs;
	if (jobs && jobs.toSend > 0)
		items.push({
			key: "kyuu:send",
			app: "/kyuu",
			title: `${plural(jobs.toSend, "application")} to send`,
			note: "Drafted and ready",
			href: "/kyuu",
			tone: "due",
		});
	if (jobs && jobs.ghostDue > 0)
		items.push({
			key: "kyuu:ghost",
			app: "/kyuu",
			title: `${plural(jobs.ghostDue, "application")} to close`,
			note: "No answer for a long while",
			href: "/kyuu",
			tone: "info",
		});
	const next = data.car?.next;
	if (data.car && next && (next.status === "overdue" || next.status === "soon"))
		items.push({
			key: "aisha:next",
			app: "/aisha",
			title: next.name,
			note: `${data.car.name} · ${carWhen(next)}`,
			href: "/aisha",
			tone: next.status === "overdue" ? "overdue" : "due",
		});
	return items;
}

function lifeItems(data: ZoneData): QueueItem[] {
	return (data.reading ?? []).map((book) => ({
		key: `tsundoku:${book.id}`,
		app: "/tsundoku" as const,
		title: book.title,
		note: [
			`p. ${book.currentPage}${book.pageCount ? ` of ${book.pageCount}` : ""}`,
			book.daysToFinish != null && `about ${plural(book.daysToFinish, "day")} to go`,
		]
			.filter(Boolean)
			.join(" · "),
		href: `/tsundoku/${book.id}`,
		tone: "info" as const,
	}));
}

/** The zone's list: overdue first, then due today, then the rest; each group in app order. */
export function buildQueue(zone: ZoneId, data: ZoneData, today: string): QueueItem[] {
	const items =
		zone === "money" ? moneyItems(data) : zone === "do" ? doItems(data, today) : lifeItems(data);
	return items
		.map((item, i) => ({ item, i }))
		.sort((a, b) => TONE_ORDER[a.item.tone] - TONE_ORDER[b.item.tone] || a.i - b.i)
		.map(({ item }) => item);
}
