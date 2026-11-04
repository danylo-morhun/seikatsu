// Read-side queries for the home's Today view: one small summary per app. Not a "use server"
// module — import only from server components. Each summary fails alone, so one app's error
// leaves the rest of the day readable, and each tile streams in as soon as its own is ready.

import {
	and,
	asc,
	db,
	eq,
	hoshiiItems,
	inArray,
	isNotNull,
	isNull,
	kurojiCaptures,
	kyuuApplications,
	lte,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
	tsundokuBooks,
} from "@seikatsu/db";
import { cache } from "react";
import { getCar as getAishaCar, getCurrentVehicle } from "@/features/aisha/actions/data";
import { getHoshii } from "@/features/hoshii/actions/data";
import { getHabits as getAllHabits } from "@/features/keizoku/actions/habits";
import { getDueToday } from "@/features/keizoku/actions/logs";
import { getBalances } from "@/features/kuroji/actions/balances";
import { hasAnyTransactions } from "@/features/kuroji/actions/data";
import { displayBalance, rollupRoots } from "@/features/kuroji/lib/balance";
import { getGhostDue, getViewCounts } from "@/features/kyuu/actions/applications";
import { getProjects } from "@/features/seiryu/actions/projects";
import { getBooks } from "@/features/tsundoku/actions/books";
import type { APPS_CONFIG } from "@/lib/app-themes";
import type { Workspace } from "@/lib/session";

async function safely<T>(load: () => Promise<T>): Promise<T | null> {
	try {
		return await load();
	} catch (error) {
		console.error("[home] summary failed", error);
		return null;
	}
}

export type MoneyToday = {
	currency: string;
	netWorth: number;
	spentThisMonth: number;
	spentToday: number;
};

type Balances = Awaited<ReturnType<typeof getBalances>>;

function totalOf(balances: Balances, type: string, skipOpening = false) {
	return rollupRoots(balances)
		.filter((b) => b.type === type && !b.hidden && (!skipOpening || b.name !== "Opening Balance"))
		.reduce((acc, b) => acc + Number(b.balance), 0);
}

/** Net worth today and what the month and the day have cost, as Kuroji's overview counts them. */
async function getMoney(ws: Workspace, today: string): Promise<MoneyToday> {
	const [month, day] = await Promise.all([
		getBalances(ws.id, `${today.slice(0, 7)}-01`, today),
		getBalances(ws.id, today, today),
	]);
	return {
		currency: ws.baseCurrency,
		netWorth:
			totalOf(month, "ASSET") - displayBalance("LIABILITY", totalOf(month, "LIABILITY", true)),
		spentThisMonth: displayBalance("EXPENSE", totalOf(month, "EXPENSE")),
		spentToday: displayBalance("EXPENSE", totalOf(day, "EXPENSE")),
	};
}

export type HabitToday = {
	id: string;
	name: string;
	emoji: string;
	done: boolean;
	/** Today holds a note or photo: clearing it asks first, as in Keizoku. */
	kept: boolean;
};

async function getHabits(): Promise<{ today: string; habits: HabitToday[] }> {
	const due = await getDueToday();
	return {
		today: due[0]?.today ?? "",
		habits: due.map(({ habit, done, kept }) => ({
			id: habit.id,
			name: habit.name,
			emoji: habit.emoji,
			done,
			kept,
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
	/** The applications quiet long enough to close as ghosted. */
	ghostIds: string[];
	active: number;
	total: number;
};

async function getJobs(): Promise<JobsToday> {
	const [counts, ghost] = await Promise.all([getViewCounts(), getGhostDue()]);
	return {
		toSend: counts.queue,
		waiting: counts.waiting,
		ghostDue: ghost.length,
		ghostIds: ghost,
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
	/** Where "done" moves it: the project's finish column, if it has one. */
	doneColumnId: string | null;
};

/** Each project's first finish column. */
async function doneColumns(projectIds: string[]): Promise<Map<string, string>> {
	if (projectIds.length === 0) return new Map();
	const rows = await db
		.select({ id: seiryuColumns.id, projectId: seiryuColumns.projectId })
		.from(seiryuColumns)
		.where(and(inArray(seiryuColumns.projectId, projectIds), eq(seiryuColumns.isDone, true)))
		.orderBy(asc(seiryuColumns.position));
	const first = new Map<string, string>();
	for (const c of rows) if (!first.has(c.projectId)) first.set(c.projectId, c.id);
	return first;
}

/** Open cards due today or earlier, oldest deadline first. */
async function getCardsDue(ws: Workspace, today: string): Promise<CardToday[]> {
	const cards = await db
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
		.orderBy(asc(seiryuCards.dueDate));
	const done = await doneColumns([...new Set(cards.map((c) => c.projectId))]);
	return cards.map((c) => ({
		...c,
		dueDate: c.dueDate ?? today,
		doneColumnId: done.get(c.projectId) ?? null,
	}));
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
	/** The cooled wants, oldest first. */
	toDecide: { id: string; title: string }[];
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
		toDecide: queue.decide.map(({ id, title }) => ({ id, title })),
		canBuy: ready.length,
		nextBuy: ready[0]?.item.title ?? null,
		plan: queue.plan.length,
		cooling: queue.cooling.length,
		total: items.length,
	};
}

/** Apple Pay payments captured but not yet added to Kuroji. */
function getCaptureCount(ws: Workspace): Promise<number> {
	return db
		.select({ id: kurojiCaptures.id })
		.from(kurojiCaptures)
		.where(and(eq(kurojiCaptures.workspaceId, ws.id), eq(kurojiCaptures.state, "pending")))
		.limit(100)
		.then((rows) => rows.length);
}

/** Whether each app holds anything yet; null when that couldn't be read. An empty app waits
 * on the home's start list instead of showing a tile of dashes. Cheap existence checks, so the
 * page knows its tiles before any summary is ready. */
export type Started = Record<keyof typeof APPS_CONFIG, boolean | null>;

/** Whether the workspace has a row in this table. */
function hasRows(table: typeof tsundokuBooks | typeof kyuuApplications | typeof hoshiiItems) {
	return (ws: Workspace) =>
		db
			.select({ id: table.id })
			.from(table)
			.where(eq(table.workspaceId, ws.id))
			.limit(1)
			.then((rows) => rows.length > 0);
}

export async function getStarted(ws: Workspace): Promise<Started> {
	const [kuroji, seiryu, tsundoku, keizoku, kyuu, aisha, hoshii] = await Promise.all([
		safely(() => hasAnyTransactions(ws.id)),
		safely(() => getProjects().then((list) => list.length > 0)),
		safely(() => hasRows(tsundokuBooks)(ws)),
		safely(() => getAllHabits().then((list) => list.length > 0)),
		safely(() => hasRows(kyuuApplications)(ws)),
		safely(() => getCurrentVehicle().then(Boolean)),
		safely(() => hasRows(hoshiiItems)(ws)),
	]);
	return {
		"/kuroji": kuroji,
		"/seiryu": seiryu,
		"/tsundoku": tsundoku,
		"/keizoku": keizoku,
		"/kyuu": kyuu,
		"/aisha": aisha,
		"/hoshii": hoshii,
	};
}

// One load per request: a tile and the header's "what's waiting" line share each summary.
export const loadMoney = cache((ws: Workspace, today: string) => safely(() => getMoney(ws, today)));
export const loadHabits = cache(() => safely(getHabits));
export const loadReading = cache(() => safely(() => getBooks().then(readingNow)));
export const loadJobs = cache(() => safely(getJobs));
export const loadCards = cache((ws: Workspace, today: string) =>
	safely(() => getCardsDue(ws, today)),
);
export const loadCar = cache((today: string) => safely(() => getCar(today)));
export const loadWants = cache((ws: Workspace, today: string) => safely(() => getWants(ws, today)));
export const loadCaptures = cache((ws: Workspace) => safely(() => getCaptureCount(ws)));
