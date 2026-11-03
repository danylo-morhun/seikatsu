// Server-only reads: each app's rows that fall in one week. Not a "use server" module — import
// only from server components. Each read fails alone (empty), so one app's error leaves the
// rest of the week readable.

import {
	accounts,
	and,
	asc,
	db,
	eq,
	gte,
	hoshiiItems,
	inArray,
	isNull,
	keizokuHabitLogs,
	keizokuHabits,
	kyuuApplications,
	kyuuEvents,
	lte,
	notInArray,
	or,
	recurringTransactions,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
	sum,
	transactionEntries,
	transactions,
	tsundokuBooks,
	tsundokuSessions,
} from "@seikatsu/db";
import { getCar, getCurrentVehicle } from "@/features/aisha/actions/data";
import { isScheduled } from "@/features/keizoku/lib/streak";
import type { WeekData } from "@/features/week/lib/week";
import type { Workspace } from "@/lib/session";

type Range = { from: string; to: string };

async function safely<T>(load: () => Promise<T[]>): Promise<T[]> {
	try {
		return await load();
	} catch (error) {
		console.error("[week] read failed", error);
		return [];
	}
}

const inRange = (column: Parameters<typeof gte>[0], { from, to }: Range) =>
	and(gte(column, from), lte(column, to));

async function getSpent(ws: Workspace, range: Range): Promise<WeekData["spent"]> {
	const rows = await db
		.select({ date: transactions.date, amount: sum(transactionEntries.baseAmount) })
		.from(transactionEntries)
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.innerJoin(accounts, eq(accounts.id, transactionEntries.accountId))
		.where(
			and(
				eq(transactions.workspaceId, ws.id),
				eq(accounts.type, "EXPENSE"),
				inRange(transactions.date, range),
			),
		)
		.groupBy(transactions.date);
	return rows.map((r) => ({ date: r.date, amount: Number(r.amount ?? 0) }));
}

async function getHabits(ws: Workspace, range: Range, week: string[]) {
	const habits = await db
		.select()
		.from(keizokuHabits)
		.where(and(eq(keizokuHabits.workspaceId, ws.id), isNull(keizokuHabits.archivedAt)));
	const ticks =
		habits.length === 0
			? []
			: await db
					.select({ date: keizokuHabitLogs.date, habitId: keizokuHabitLogs.habitId })
					.from(keizokuHabitLogs)
					.where(
						and(
							inArray(
								keizokuHabitLogs.habitId,
								habits.map((h) => h.id),
							),
							inRange(keizokuHabitLogs.date, range),
						),
					);
	const byId = new Map(habits.map((h) => [h.id, h]));
	return {
		ticks: ticks.flatMap((t) => {
			const habit = byId.get(t.habitId);
			return habit ? [{ date: t.date, name: habit.name, emoji: habit.emoji }] : [];
		}),
		expected: week.map((date) => ({
			date,
			count: habits.filter((h) => isScheduled(h, date)).length,
		})),
	};
}

async function getPages(ws: Workspace, range: Range): Promise<WeekData["pages"]> {
	const rows = await db
		.select({ date: tsundokuSessions.date, pages: sum(tsundokuSessions.pagesRead) })
		.from(tsundokuSessions)
		.innerJoin(tsundokuBooks, eq(tsundokuBooks.id, tsundokuSessions.bookId))
		.where(and(eq(tsundokuBooks.workspaceId, ws.id), inRange(tsundokuSessions.date, range)))
		.groupBy(tsundokuSessions.date);
	return rows.map((r) => ({ date: r.date, pages: Number(r.pages ?? 0) }));
}

/** Kilometres per day from the car's readings, and what Aisha has dated in the week. */
async function getCarWeek(today: string, range: Range) {
	const vehicle = await getCurrentVehicle();
	if (!vehicle) return { driven: [], due: [] };
	const car = await getCar(vehicle, today);
	const readings = [...car.readings].sort((a, b) => a.date.localeCompare(b.date));
	const driven: WeekData["driven"] = [];
	for (let i = 1; i < readings.length; i++) {
		const { date, km } = readings[i];
		const km0 = readings[i - 1].km;
		if (date >= range.from && date <= range.to && km > km0) driven.push({ date, km: km - km0 });
	}
	const due = [...car.queue.due, ...car.queue.later].flatMap((q) =>
		q.when && q.when >= range.from && q.when <= range.to
			? [
					{
						date: q.when < today ? today : q.when,
						name: q.entry.kind === "item" ? q.entry.item.name : q.entry.doc.name,
					},
				]
			: [],
	);
	return { driven, due };
}

async function getCards(ws: Workspace, range: Range) {
	const cards = await db
		.select({
			id: seiryuCards.id,
			title: seiryuCards.title,
			projectId: seiryuCards.projectId,
			projectName: seiryuProjects.name,
			dueDate: seiryuCards.dueDate,
			doneOn: seiryuCards.doneOn,
			isDone: seiryuColumns.isDone,
			archivedAt: seiryuCards.archivedAt,
		})
		.from(seiryuCards)
		.innerJoin(seiryuColumns, eq(seiryuColumns.id, seiryuCards.columnId))
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
		.where(
			and(
				eq(seiryuProjects.workspaceId, ws.id),
				or(inRange(seiryuCards.doneOn, range), inRange(seiryuCards.dueDate, range)),
			),
		);
	return {
		done: cards.flatMap((c) =>
			c.doneOn && c.isDone && c.doneOn >= range.from && c.doneOn <= range.to
				? [{ date: c.doneOn, id: c.id, title: c.title, projectId: c.projectId }]
				: [],
		),
		due: cards.flatMap((c) =>
			c.dueDate && !c.isDone && !c.archivedAt && c.dueDate >= range.from && c.dueDate <= range.to
				? [
						{
							date: c.dueDate,
							id: c.id,
							title: c.title,
							projectId: c.projectId,
							projectName: c.projectName,
						},
					]
				: [],
		),
	};
}

async function getJobs(ws: Workspace, range: Range): Promise<WeekData["jobs"]> {
	const [sent, events] = await Promise.all([
		db
			.select({ date: kyuuApplications.dateApplied, company: kyuuApplications.company })
			.from(kyuuApplications)
			.where(
				and(
					eq(kyuuApplications.workspaceId, ws.id),
					notInArray(kyuuApplications.status, ["sourced", "drafted"]),
					inRange(kyuuApplications.dateApplied, range),
				),
			),
		db
			.select({
				date: kyuuEvents.date,
				company: kyuuApplications.company,
				what: kyuuEvents.kind,
			})
			.from(kyuuEvents)
			.innerJoin(kyuuApplications, eq(kyuuApplications.id, kyuuEvents.applicationId))
			.where(and(eq(kyuuApplications.workspaceId, ws.id), inRange(kyuuEvents.date, range))),
	]);
	return [
		...sent.map((s) => ({ ...s, what: "applied" as const })),
		...events.flatMap((e) => (e.date ? [{ date: e.date, company: e.company, what: e.what }] : [])),
	];
}

async function getWants(ws: Workspace, range: Range): Promise<WeekData["wants"]> {
	const items = await db
		.select()
		.from(hoshiiItems)
		.where(
			and(
				eq(hoshiiItems.workspaceId, ws.id),
				or(
					inRange(hoshiiItems.coolUntil, range),
					inRange(hoshiiItems.keptOn, range),
					inRange(hoshiiItems.boughtOn, range),
					inRange(hoshiiItems.releasedOn, range),
				),
			),
		);
	const within = (d: string | null) => d != null && d >= range.from && d <= range.to;
	return items.flatMap((i) => [
		...(i.state === "cooling" && within(i.coolUntil)
			? [{ date: i.coolUntil, title: i.title, what: "cools" as const }]
			: []),
		...(within(i.keptOn) && !i.skippedCooling
			? [{ date: i.keptOn as string, title: i.title, what: "kept" as const }]
			: []),
		...(within(i.boughtOn)
			? [{ date: i.boughtOn as string, title: i.title, what: "bought" as const }]
			: []),
		...(within(i.releasedOn)
			? [{ date: i.releasedOn as string, title: i.title, what: "released" as const }]
			: []),
	]);
}

async function getBills(ws: Workspace, range: Range): Promise<WeekData["bills"]> {
	const rows = await db
		.select()
		.from(recurringTransactions)
		.where(
			and(
				eq(recurringTransactions.workspaceId, ws.id),
				eq(recurringTransactions.isActive, true),
				inRange(recurringTransactions.nextDate, range),
			),
		)
		.orderBy(asc(recurringTransactions.nextDate));
	return rows.map((r) => ({
		date: r.nextDate,
		title: r.description || "Recurring",
		amount: Number(r.amount),
		currency: r.currency,
	}));
}

/** Everything the week view needs, read at once. */
export async function getWeekData(ws: Workspace, today: string, week: string[]): Promise<WeekData> {
	const range = { from: week[0], to: week[6] };
	const [spent, habits, pages, car, cards, jobs, wants, bills] = await Promise.all([
		safely(() => getSpent(ws, range)),
		getHabits(ws, range, week).catch((error) => {
			console.error("[week] read failed", error);
			return { ticks: [], expected: [] };
		}),
		safely(() => getPages(ws, range)),
		getCarWeek(today, range).catch((error) => {
			console.error("[week] read failed", error);
			return { driven: [], due: [] };
		}),
		getCards(ws, range).catch((error) => {
			console.error("[week] read failed", error);
			return { done: [], due: [] };
		}),
		safely(() => getJobs(ws, range)),
		safely(() => getWants(ws, range)),
		safely(() => getBills(ws, range)),
	]);
	return {
		spent,
		ticks: habits.ticks,
		expected: habits.expected,
		pages,
		driven: car.driven,
		cardsDone: cards.done,
		cardsDue: cards.due,
		jobs,
		wants,
		car: car.due,
		bills,
	};
}
