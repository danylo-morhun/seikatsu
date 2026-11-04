// What the day waits on: one list across the apps, most urgent first, each row with the one
// thing to do about it. Pure — the home loads each app's summary (./today) and hands them in.

import type { CardToday, CarToday, JobsToday, WantsToday } from "@/features/home/lib/today";
import type { APPS_CONFIG } from "@/lib/app-themes";

type AppHref = keyof typeof APPS_CONFIG;

export type QueueTone = "overdue" | "due" | "info";

/** What the row's button does, right on the home. "open" only links into the app. */
export type QueueAct =
	| { kind: "done"; cardId: string; columnId: string; from: { columnId: string; position: string } }
	| { kind: "decide"; itemId: string; base: number | null; currency: string }
	| { kind: "ghost"; ids: string[] }
	| { kind: "open" };

export type QueueItem = {
	key: string;
	app: AppHref;
	title: string;
	note: string;
	href: string;
	tone: QueueTone;
	act: QueueAct;
};

/** Each app's summary as the home loads it; null when it couldn't be read or isn't set up. */
export type QueueData = {
	captures: number | null;
	wants: WantsToday | null;
	cards: CardToday[] | null;
	jobs: JobsToday | null;
	car: CarToday | null;
};

/** Up to this many cooled wants get their own row; more fold into one. */
const WANTS_APART = 3;

const TONE_ORDER: Record<QueueTone, number> = { overdue: 0, due: 1, info: 2 };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function daysLate(dueDate: string, today: string) {
	return Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000);
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

function cardItems(cards: CardToday[], today: string): QueueItem[] {
	return cards.map((card) => {
		const late = daysLate(card.dueDate, today);
		return {
			key: `seiryu:${card.id}`,
			app: "/seiryu",
			title: card.title,
			note: `${card.projectName} · ${late > 0 ? `${plural(late, "day")} overdue` : "due today"}`,
			href: `/seiryu/${card.projectId}/${card.id}`,
			tone: late > 0 ? "overdue" : "due",
			act: card.doneColumnId
				? {
						kind: "done",
						cardId: card.id,
						columnId: card.doneColumnId,
						from: { columnId: card.columnId, position: card.position },
					}
				: { kind: "open" },
		};
	});
}

function wantItems(wants: WantsToday): QueueItem[] {
	const items: QueueItem[] =
		wants.toDecide.length <= WANTS_APART
			? wants.toDecide.map((want) => ({
					key: `hoshii:${want.id}`,
					app: "/hoshii",
					title: want.title,
					note: "Cooled down: still want it?",
					href: "/hoshii",
					tone: "due",
					act: { kind: "decide", itemId: want.id, base: want.base, currency: wants.currency },
				}))
			: [
					{
						key: "hoshii:decide",
						app: "/hoshii",
						title: `${plural(wants.toDecide.length, "want")} to decide`,
						note: "Cooled down: keep each or let it go",
						href: "/hoshii",
						tone: "due",
						act: { kind: "open" },
					},
				];
	if (wants.canBuy > 0)
		items.push({
			key: "hoshii:buy",
			app: "/hoshii",
			title: wants.nextBuy ? `Can buy ${wants.nextBuy}` : `${plural(wants.canBuy, "want")} funded`,
			note: wants.canBuy > 1 ? `${wants.canBuy} wants fully funded` : "Fully funded by the piggy",
			href: "/hoshii",
			tone: "info",
			act: { kind: "open" },
		});
	return items;
}

function jobItems(jobs: JobsToday): QueueItem[] {
	const items: QueueItem[] = [];
	if (jobs.toSend > 0)
		items.push({
			key: "kyuu:send",
			app: "/kyuu",
			title: `${plural(jobs.toSend, "application")} to send`,
			note: "Drafted and ready",
			href: "/kyuu",
			tone: "due",
			act: { kind: "open" },
		});
	if (jobs.ghostIds.length > 0)
		items.push({
			key: "kyuu:ghost",
			app: "/kyuu",
			title: `${plural(jobs.ghostIds.length, "application")} with no answer`,
			note: "Quiet long enough to close as ghosted",
			href: "/kyuu?view=waiting",
			tone: "info",
			act: { kind: "ghost", ids: jobs.ghostIds },
		});
	return items;
}

/** The day's list: overdue first, then due today, then the rest; each group in app order. */
export function buildQueue(data: QueueData, today: string): QueueItem[] {
	const items: QueueItem[] = [...cardItems(data.cards ?? [], today)];
	const next = data.car?.next;
	if (data.car && next && (next.status === "overdue" || next.status === "soon"))
		items.push({
			key: "aisha:next",
			app: "/aisha",
			title: next.name,
			note: `${data.car.name} · ${carWhen(next)}`,
			href: "/aisha",
			tone: next.status === "overdue" ? "overdue" : "due",
			act: { kind: "open" },
		});
	if ((data.captures ?? 0) > 0)
		items.push({
			key: "kuroji:captures",
			app: "/kuroji",
			title: `${plural(data.captures ?? 0, "payment")} to add`,
			note: "Apple Pay payments waiting in Kuroji",
			href: "/kuroji",
			tone: "due",
			act: { kind: "open" },
		});
	if (data.wants) items.push(...wantItems(data.wants));
	if (data.jobs) items.push(...jobItems(data.jobs));
	return items
		.map((item, i) => ({ item, i }))
		.sort((a, b) => TONE_ORDER[a.item.tone] - TONE_ORDER[b.item.tone] || a.i - b.i)
		.map(({ item }) => item);
}
