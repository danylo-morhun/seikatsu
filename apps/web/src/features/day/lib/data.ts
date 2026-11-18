// The day's reads: its plan, what's snoozed, and the picked cards' state. Plain server module
// (not "use server"); takes a workspace id, no session, so the pushes reuse it.

import {
	and,
	asc,
	type DayPlan,
	dayPlans,
	db,
	eq,
	inArray,
	isNull,
	notificationPrefs,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
} from "@seikatsu/db";
import { cache } from "react";
import { cardIdOf, type DayPick, DEFAULT_EVENING, pickStates } from "@/features/day/lib/day";
import { loadAgenda } from "@/features/home/lib/agenda";
import { buildQueue, type Money, type QueueItem } from "@/features/home/lib/queue";
import { localClock } from "@/features/pwa/lib/schedule";
import { addDays } from "@/features/seiryu/lib/filters";
import type { Workspace } from "@/lib/session";
import { getUserTimeZone } from "@/lib/timezone";

export async function readPlan(workspaceId: string, day: string): Promise<DayPlan | null> {
	const plan = await db.query.dayPlans.findFirst({
		where: and(eq(dayPlans.workspaceId, workspaceId), eq(dayPlans.day, day)),
	});
	return plan ?? null;
}

/** A picked card still open, with what its Done needs. */
export type OpenCard = {
	id: string;
	title: string;
	projectId: string;
	columnId: string;
	position: string;
	doneColumnId: string | null;
};

/** Which of these cards are still open (live project, not archived, not in a done lane). */
export async function readOpenCards(workspaceId: string, ids: string[]): Promise<OpenCard[]> {
	if (ids.length === 0) return [];
	const cards = await db
		.select({
			id: seiryuCards.id,
			title: seiryuCards.title,
			projectId: seiryuCards.projectId,
			columnId: seiryuCards.columnId,
			position: seiryuCards.position,
		})
		.from(seiryuCards)
		.innerJoin(seiryuColumns, eq(seiryuCards.columnId, seiryuColumns.id))
		.innerJoin(seiryuProjects, eq(seiryuCards.projectId, seiryuProjects.id))
		.where(
			and(
				inArray(seiryuCards.id, ids),
				eq(seiryuProjects.workspaceId, workspaceId),
				isNull(seiryuProjects.archivedAt),
				isNull(seiryuCards.archivedAt),
				eq(seiryuColumns.isDone, false),
			),
		);
	if (cards.length === 0) return [];
	const done = await db
		.select({ id: seiryuColumns.id, projectId: seiryuColumns.projectId })
		.from(seiryuColumns)
		.where(
			and(
				inArray(seiryuColumns.projectId, [...new Set(cards.map((c) => c.projectId))]),
				eq(seiryuColumns.isDone, true),
			),
		)
		.orderBy(asc(seiryuColumns.position));
	const first = new Map<string, string>();
	for (const c of done) if (!first.has(c.projectId)) first.set(c.projectId, c.id);
	return cards.map((c) => ({ ...c, doneColumnId: first.get(c.projectId) ?? null }));
}

/** Open cards due on one day, for the evening's look at tomorrow. */
export function readCardsOn(workspaceId: string, day: string) {
	return db
		.select({ id: seiryuCards.id, title: seiryuCards.title, dueTime: seiryuCards.dueTime })
		.from(seiryuCards)
		.innerJoin(seiryuColumns, eq(seiryuCards.columnId, seiryuColumns.id))
		.innerJoin(seiryuProjects, eq(seiryuCards.projectId, seiryuProjects.id))
		.where(
			and(
				eq(seiryuProjects.workspaceId, workspaceId),
				isNull(seiryuProjects.archivedAt),
				isNull(seiryuCards.archivedAt),
				eq(seiryuColumns.isDone, false),
				eq(seiryuCards.dueDate, day),
			),
		)
		.orderBy(asc(seiryuCards.dueTime));
}

export type PickRow = ReturnType<typeof pickStates>[number] & {
	/** For a picked card, what its Done needs (null once it's finished). */
	card: OpenCard | null;
};

export type Day = {
	plan: DayPlan | null;
	/** The list as Today shows it (snoozed rows left out). */
	queue: QueueItem[];
	picks: PickRow[];
	/** Yesterday's picks not done: offered first in the morning. */
	carried: DayPick[];
};

/** Everything the day's views share: the list, the plan and how far its picks have come. */
async function readDay(ws: Workspace, today: string, fmt: Money): Promise<Day> {
	const yesterday = addDays(today, -1);
	const [agenda, plan, before] = await Promise.all([
		loadAgenda(ws, today),
		readPlan(ws.id, today),
		readPlan(ws.id, yesterday),
	]);
	const all = buildQueue({ ...agenda, snoozed: null }, today, fmt);
	const queue = buildQueue(agenda, today, fmt);
	const snoozed = (agenda.snoozed ?? []).map((s) => s.key);
	const picked = [...(plan?.picks ?? []), ...(before?.picks ?? [])];
	const cards = await readOpenCards(
		ws.id,
		picked.flatMap((p) => cardIdOf(p.key) ?? []),
	);
	const open = new Map(cards.map((c) => [c.id, c]));
	const openCards = new Set(open.keys());
	const withCard = (states: ReturnType<typeof pickStates>): PickRow[] =>
		states.map((s) => {
			const id = cardIdOf(s.key);
			return { ...s, card: id ? (open.get(id) ?? null) : null };
		});
	const picks = withCard(
		pickStates(plan?.picks ?? [], { ticked: plan?.ticked ?? [], queue: all, snoozed, openCards }),
	);
	const carried = before
		? pickStates(before.picks, { ticked: before.ticked, queue: all, snoozed, openCards })
				.filter((s) => !s.done && !snoozed.includes(s.key))
				.map(({ key, title, href, app }) => ({ key, title, href, app }))
		: [];
	return { plan, queue, picks, carried };
}

/** Request-cached: Today, the morning and the evening read it once each. */
export const loadDay = cache(readDay);

/** When the evening starts for this workspace, and whether its push is on. */
export async function readEvening(workspaceId: string): Promise<{ time: string; push: boolean }> {
	const prefs = await db.query.notificationPrefs.findFirst({
		where: eq(notificationPrefs.workspaceId, workspaceId),
		columns: { eveningTime: true, eveningClose: true },
	});
	return {
		time: prefs?.eveningTime.slice(0, 5) ?? DEFAULT_EVENING,
		push: prefs?.eveningClose ?? true,
	};
}

/** Minutes since the user's local midnight, now. */
export async function getUserMinutes(): Promise<number> {
	return localClock(await getUserTimeZone()).minutes;
}
