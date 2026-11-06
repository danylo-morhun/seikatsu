// What the day waits on: one list across the apps, most urgent first, each row with the one
// thing to do about it. Pure — the home loads each app's summary (./today) and hands them in.

import { type GoalPace, goalAttention } from "@/features/goals/lib/progress";
import type { CardToday, CarToday, WantsToday } from "@/features/home/lib/today";
import type { FundDue, MoneyAgenda } from "@/features/kuroji/lib/agenda";
import type { JobsAgenda } from "@/features/kyuu/lib/agenda";
import type { APPS_CONFIG } from "@/lib/app-themes";

type AppHref = keyof typeof APPS_CONFIG;
/** Where a row belongs: an app, or Goals (the shell's own). */
export type QueueSource = AppHref | "/goals";

export type QueueTone = "overdue" | "due" | "info";

/** What the row's button does, right on the home. "open" only links into the app. */
export type QueueAct =
	| { kind: "done"; cardId: string; columnId: string; from: { columnId: string; position: string } }
	| { kind: "decide"; itemId: string; base: number | null; currency: string }
	| { kind: "ghost"; ids: string[] }
	| { kind: "followUp"; id: string; company: string }
	| { kind: "fund"; fund: FundDue }
	| { kind: "open" };

export type QueueItem = {
	key: string;
	app: QueueSource;
	title: string;
	note: string;
	href: string;
	tone: QueueTone;
	act: QueueAct;
};

/** Each app's own rule for what waits, folded: past this many, one row stands for them all. */
const APART = 3;

/** Each app's summary as the home loads it; null when it couldn't be read or isn't set up. */
export type QueueData = {
	money: MoneyAgenda | null;
	wants: WantsToday | null;
	cards: CardToday[] | null;
	jobs: JobsAgenda | null;
	car: CarToday | null;
	/** Absent where goals aren't read (older callers, tests). */
	goals?: GoalPace[] | null;
};

const TONE_ORDER: Record<QueueTone, number> = { overdue: 0, due: 1, info: 2 };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function daysLate(dueDate: string, today: string) {
	return Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000);
}

/** How far off (or past) the car's next service is, by distance when it has one. */
function carWhen(next: CarToday["due"][number]): string {
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
			note: `${card.projectName} · ${late > 0 ? `${plural(late, "day")} overdue` : card.dueTime ? `due ${card.dueTime}` : "due today"}`,
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
		wants.toDecide.length <= APART
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

function jobItems(jobs: JobsAgenda, today: string): QueueItem[] {
	const items: QueueItem[] = jobs.calls.map((call) => ({
		key: `kyuu:call:${call.id}:${call.date}`,
		app: "/kyuu",
		title: `${call.kind === "interview" ? "Interview" : "Screening"} · ${call.company}`,
		note: [call.date === today ? "Today" : "Tomorrow", call.time].filter(Boolean).join(" at "),
		href: `/kyuu/${call.id}`,
		tone: call.date === today ? "due" : "info",
		act: { kind: "open" },
	}));
	if (jobs.mailReview > 0)
		items.push({
			key: "kyuu:mail",
			app: "/kyuu",
			title: `${plural(jobs.mailReview, "answer")} from mail to check`,
			note: "Gemini wasn't sure which application it was",
			href: "/kyuu",
			tone: "due",
			act: { kind: "open" },
		});
	if (jobs.toSend > 0)
		items.push({
			key: "kyuu:send",
			app: "/kyuu",
			title: `${plural(jobs.toSend, "application")} to send`,
			note: "Not sent yet",
			href: "/kyuu?view=queue",
			tone: "due",
			act: { kind: "open" },
		});
	if (jobs.followUps.length > APART)
		items.push({
			key: "kyuu:follow",
			app: "/kyuu",
			title: `${plural(jobs.followUps.length, "follow-up")} due`,
			note: "A week with no answer: time to write again",
			href: "/kyuu?view=waiting",
			tone: "due",
			act: { kind: "open" },
		});
	else
		for (const app of jobs.followUps)
			items.push({
				key: `kyuu:follow:${app.id}`,
				app: "/kyuu",
				title: `Follow up · ${app.company}`,
				note: "A week with no answer",
				href: `/kyuu/${app.id}`,
				tone: "due",
				act: { kind: "followUp", id: app.id, company: app.company },
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

function moneyItems(money: MoneyAgenda, fmt: Money): QueueItem[] {
	const items: QueueItem[] = [];
	if (money.captures > 0)
		items.push({
			key: "kuroji:captures",
			app: "/kuroji",
			title: `${plural(money.captures, "payment")} to add`,
			note: "Apple Pay payments waiting in Kuroji",
			href: "/kuroji",
			tone: "due",
			act: { kind: "open" },
		});
	if (money.uncategorized > 0)
		items.push({
			key: "kuroji:uncategorized",
			app: "/kuroji",
			title: `${plural(money.uncategorized, "bank payment")} without a category`,
			note: "From the last 30 days",
			href: "/kuroji?tab=transactions",
			tone: "info",
			act: { kind: "open" },
		});
	for (const fund of money.funds)
		items.push({
			key: `kuroji:fund:${fund.id}`,
			app: "/kuroji",
			title: `Put ${fmt(fund.amount, fund.currency)} into ${fund.name}`,
			note: "This month's instalment",
			href: "/kuroji?tab=plan",
			tone: "info",
			act: { kind: "fund", fund },
		});
	return items;
}

function carItems(car: CarToday): QueueItem[] {
	return car.due.map((entry, i) => ({
		key: `aisha:${i}:${entry.name}`,
		app: "/aisha",
		title: entry.name,
		note: `${car.name} · ${carWhen(entry)}`,
		href: "/aisha",
		tone: entry.status === "overdue" ? "overdue" : "due",
		act: { kind: "open" },
	}));
}

const GOAL_NOTE = {
	soon: "Its day is close",
	behind: "Behind its pace",
	over: "Its day has passed",
};

/** Goals that ask for attention; never "overdue", so Week doesn't carry them as late work. */
function goalItems(goals: GoalPace[], today: string): QueueItem[] {
	return goals.flatMap((goal) => {
		const why = goalAttention(goal, today);
		if (!why) return [];
		const done = goal.ratio != null ? ` · ${Math.round(goal.ratio * 100)}%` : "";
		return [
			{
				key: `goals:${goal.id}`,
				app: "/goals" as const,
				title: goal.name,
				note: `${GOAL_NOTE[why]}${done}`,
				href: "/goals",
				tone: why === "soon" ? ("info" as const) : ("due" as const),
				act: { kind: "open" as const },
			},
		];
	});
}

/** Money as the app writes it ("500 zł"); the composer passes Kuroji's formatter. */
export type Money = (amount: number, currency: string) => string;

/** The day's list: overdue first, then due today, then the rest; each group in app order. */
export function buildQueue(
	data: QueueData,
	today: string,
	fmt: Money = (n, c) => `${Math.round(n)} ${c}`,
): QueueItem[] {
	const items: QueueItem[] = [
		...cardItems(data.cards ?? [], today),
		...(data.car ? carItems(data.car) : []),
		...(data.money ? moneyItems(data.money, fmt) : []),
		...(data.wants ? wantItems(data.wants) : []),
		...(data.jobs ? jobItems(data.jobs, today) : []),
		...(data.goals ? goalItems(data.goals, today) : []),
	];
	return items
		.map((item, i) => ({ item, i }))
		.sort((a, b) => TONE_ORDER[a.item.tone] - TONE_ORDER[b.item.tone] || a.i - b.i)
		.map(({ item }) => item);
}
