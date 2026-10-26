// Read-side queries for the home's Today view: one small summary per app. Not a "use server"
// module — import only from the RSC page. Each summary fails alone, so one app's error leaves
// the rest of the day readable.

import { getCar as getAishaCar, getCurrentVehicle } from "@/features/aisha/actions/data";
import { getHoshii } from "@/features/hoshii/actions/data";
import { getHabits as getAllHabits } from "@/features/keizoku/actions/habits";
import { getDueToday } from "@/features/keizoku/actions/logs";
import { getBalances } from "@/features/kuroji/actions/balances";
import { hasAnyTransactions } from "@/features/kuroji/actions/transactions";
import { displayBalance, rollupRoots } from "@/features/kuroji/lib/balance";
import { getGhostDue, getViewCounts } from "@/features/kyuu/actions/applications";
import { getProjects } from "@/features/seiryu/actions/projects";
import { getBooks } from "@/features/tsundoku/actions/books";
import type { APPS_CONFIG } from "@/lib/app-themes";
import type { Workspace } from "@/lib/session";
import {
	and,
	asc,
	db,
	eq,
	isNotNull,
	isNull,
	lte,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
} from "@seikatsu/db";

async function safely<T>(load: () => Promise<T>): Promise<T | null> {
	try {
		return await load();
	} catch (error) {
		console.error("[home] summary failed", error);
		return null;
	}
}

export type MoneyToday = { currency: string; netWorth: number; spentThisMonth: number };

/** Net worth today and what the month has cost so far, as Kuroji's overview counts them. */
function getMoney(ws: Workspace, today: string): Promise<MoneyToday> {
	return getBalances(ws.id, `${today.slice(0, 7)}-01`, today).then((balances) => {
		const roots = rollupRoots(balances);
		const total = (type: string, skipOpening = false) =>
			roots
				.filter(
					(b) => b.type === type && !b.hidden && (!skipOpening || b.name !== "Opening Balance"),
				)
				.reduce((acc, b) => acc + Number(b.balance), 0);
		return {
			currency: ws.baseCurrency,
			netWorth: total("ASSET") - displayBalance("LIABILITY", total("LIABILITY", true)),
			spentThisMonth: displayBalance("EXPENSE", total("EXPENSE")),
		};
	});
}

export type HabitToday = { id: string; name: string; emoji: string; done: boolean };

async function getHabits(): Promise<{ today: string; habits: HabitToday[] }> {
	const due = await getDueToday();
	return {
		today: due[0]?.today ?? "",
		habits: due.map(({ habit, done }) => ({
			id: habit.id,
			name: habit.name,
			emoji: habit.emoji,
			done,
		})),
	};
}

export type BookToday = {
	id: string;
	title: string;
	authors: string[];
	currentPage: number;
	pageCount: number | null;
	daysToFinish: number | null;
};

/** Books being read, the one read most recently started first. */
function readingNow(books: Awaited<ReturnType<typeof getBooks>>): BookToday[] {
	return books
		.filter((b) => b.status === "reading")
		.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))
		.map((b) => ({
			id: b.id,
			title: b.title,
			authors: b.authors ?? [],
			currentPage: b.currentPage,
			pageCount: b.pageCount,
			daysToFinish: b.daysToFinish,
		}));
}

export type JobsToday = {
	toSend: number;
	waiting: number;
	ghostDue: number;
	active: number;
	total: number;
};

async function getJobs(): Promise<JobsToday> {
	const [counts, ghost] = await Promise.all([getViewCounts(), getGhostDue()]);
	return {
		toSend: counts.queue,
		waiting: counts.waiting,
		ghostDue: ghost.length,
		active: counts.active,
		total: counts.all + counts.archived,
	};
}

export type CardToday = {
	id: string;
	title: string;
	dueDate: string;
	projectId: string;
	projectName: string;
};

/** Open cards due today or earlier, oldest deadline first. */
function getCardsDue(ws: Workspace, today: string): Promise<CardToday[]> {
	return db
		.select({
			id: seiryuCards.id,
			title: seiryuCards.title,
			dueDate: seiryuCards.dueDate,
			projectId: seiryuProjects.id,
			projectName: seiryuProjects.name,
		})
		.from(seiryuCards)
		.innerJoin(seiryuColumns, eq(seiryuCards.columnId, seiryuColumns.id))
		.innerJoin(seiryuProjects, eq(seiryuCards.projectId, seiryuProjects.id))
		.where(
			and(
				eq(seiryuProjects.workspaceId, ws.id),
				isNull(seiryuProjects.archivedAt),
				isNull(seiryuCards.archivedAt),
				eq(seiryuColumns.isDone, false),
				isNotNull(seiryuCards.dueDate),
				lte(seiryuCards.dueDate, today),
			),
		)
		.orderBy(asc(seiryuCards.dueDate))
		.then((rows) => rows.map((r) => ({ ...r, dueDate: r.dueDate ?? today })));
}

export type CarToday = {
	vehicleId: string;
	name: string;
	currentKm: number;
	next: {
		name: string;
		status: "ok" | "soon" | "overdue" | "unknown";
		kmLeft: number | null;
		daysLeft: number | null;
	} | null;
};

/** What the car needs next: the head of Aisha's queue, maintenance or a document. */
async function getCar(today: string): Promise<CarToday | null> {
	const vehicle = await getCurrentVehicle();
	if (!vehicle) return null;
	const car = await getAishaCar(vehicle, today);
	const head = car.queue.due[0] ?? car.queue.later[0];
	return {
		vehicleId: vehicle.id,
		name: `${vehicle.make} ${vehicle.model}`,
		currentKm: car.currentKm,
		next: !head
			? null
			: head.entry.kind === "item"
				? {
						name: head.entry.item.name,
						status: head.status,
						kmLeft: head.entry.item.due.kmLeft,
						daysLeft: head.entry.item.due.daysLeft,
					}
				: {
						name: head.entry.doc.name,
						status: head.status,
						kmLeft: null,
						daysLeft: head.entry.doc.daysLeft,
					},
	};
}

export type WantsToday = {
	decide: number;
	canBuy: number;
	/** The first want in the Plan the piggy fully covers. */
	nextBuy: string | null;
	plan: number;
	cooling: number;
	total: number;
};

/** What Hoshii waits on: cooled wants to decide, and what the piggy can already buy. */
async function getWants(ws: Workspace, today: string): Promise<WantsToday> {
	const { queue, items, piggy } = await getHoshii(ws, today);
	const ready = piggy ? queue.plan.filter((p) => p.share != null && p.share >= 1) : [];
	return {
		decide: queue.decide.length,
		canBuy: ready.length,
		nextBuy: ready[0]?.item.title ?? null,
		plan: queue.plan.length,
		cooling: queue.cooling.length,
		total: items.length,
	};
}

/** Whether each app holds anything yet; null when that couldn't be read. An empty app waits
 * on the home's start list instead of showing a tile of dashes. */
export type Started = Record<keyof typeof APPS_CONFIG, boolean | null>;

export async function getToday(ws: Workspace, today: string) {
	const [money, habits, books, jobs, cards, car, hasMoney, hasHabits, hasProjects, hasCar, wants] =
		await Promise.all([
			safely(() => getMoney(ws, today)),
			safely(getHabits),
			safely(getBooks),
			safely(getJobs),
			safely(() => getCardsDue(ws, today)),
			safely(() => getCar(today)),
			safely(() => hasAnyTransactions(ws.id)),
			safely(() => getAllHabits().then((list) => list.length > 0)),
			safely(() => getProjects().then((list) => list.length > 0)),
			safely(() => getCurrentVehicle().then(Boolean)),
			safely(() => getWants(ws, today)),
		]);
	const started: Started = {
		"/kuroji": hasMoney,
		"/seiryu": hasProjects,
		"/tsundoku": books && books.length > 0,
		"/keizoku": hasHabits,
		"/kyuu": jobs && jobs.total > 0,
		"/aisha": hasCar,
		"/hoshii": wants && wants.total > 0,
	};
	return { money, habits, reading: books && readingNow(books), jobs, cards, car, wants, started };
}

export type Today = Awaited<ReturnType<typeof getToday>>;
