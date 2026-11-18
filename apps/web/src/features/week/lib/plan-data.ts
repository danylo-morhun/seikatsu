// The week's plan, read: which week is due for planning, its focus and how far each item has
// come (the day's rules: a card when finished, a row when gone, the user's words when ticked).
// Plain server module.

import { and, dayPlans, db, eq, gte, lte, type WeekPlan, weekPlans } from "@seikatsu/db";
import { cache } from "react";
import { getUserMinutes, type PickRow, readEvening, readOpenCards } from "@/features/day/lib/data";
import { cardIdOf, type DayPick, pickStates } from "@/features/day/lib/day";
import { loadAgenda } from "@/features/home/lib/agenda";
import { buildQueue, type Money } from "@/features/home/lib/queue";
import { addDays } from "@/features/seiryu/lib/filters";
import { mondayOf, planTarget, weekPhase } from "@/features/week/lib/rhythm";
import type { Workspace } from "@/lib/session";

export async function readWeekPlan(
	workspaceId: string,
	weekStart: string,
): Promise<WeekPlan | null> {
	const plan = await db.query.weekPlans.findFirst({
		where: and(eq(weekPlans.workspaceId, workspaceId), eq(weekPlans.weekStart, weekStart)),
	});
	return plan ?? null;
}

/** The day plans of a stretch of days, for the week's look back and its days. */
export function readDayPlans(workspaceId: string, from: string, to: string) {
	return db
		.select({
			day: dayPlans.day,
			plannedAt: dayPlans.plannedAt,
			closedAt: dayPlans.closedAt,
			result: dayPlans.result,
			picks: dayPlans.picks,
		})
		.from(dayPlans)
		.where(
			and(eq(dayPlans.workspaceId, workspaceId), gte(dayPlans.day, from), lte(dayPlans.day, to)),
		);
}

/** How far each item of a plan has come, as of today. */
export async function focusStates(
	ws: Workspace,
	today: string,
	fmt: Money,
	picks: DayPick[],
	ticked: string[],
): Promise<PickRow[]> {
	if (picks.length === 0) return [];
	const [agenda, cards] = await Promise.all([
		loadAgenda(ws, today),
		readOpenCards(
			ws.id,
			picks.flatMap((p) => cardIdOf(p.key) ?? []),
		),
	]);
	const open = new Map(cards.map((c) => [c.id, c]));
	const states = pickStates(picks, {
		ticked,
		queue: buildQueue({ ...agenda, snoozed: null }, today, fmt),
		snoozed: (agenda.snoozed ?? []).map((s) => s.key),
		openCards: new Set(open.keys()),
	});
	return states.map((s) => {
		const id = cardIdOf(s.key);
		return { ...s, card: id ? (open.get(id) ?? null) : null };
	});
}

export type WeekRhythm = {
	/** The Monday of the week due for planning (next week from Sunday evening on). */
	target: string;
	phase: "plan" | "week";
	/** This week's plan and its focus as it stands. */
	current: WeekPlan | null;
	focus: PickRow[];
};

async function readWeekRhythm(ws: Workspace, today: string, fmt: Money): Promise<WeekRhythm> {
	const [evening, minutes] = await Promise.all([readEvening(ws.id), getUserMinutes()]);
	const target = planTarget(today, minutes, evening.time);
	const monday = mondayOf(today);
	const [targetPlan, current] = await Promise.all([
		readWeekPlan(ws.id, target),
		target === monday ? null : readWeekPlan(ws.id, monday),
	]);
	const thisWeek = target === monday ? targetPlan : current;
	const focus = thisWeek?.plannedAt
		? await focusStates(ws, today, fmt, thisWeek.focus, thisWeek.ticked)
		: [];
	return { target, phase: weekPhase(targetPlan), current: thisWeek, focus };
}

/** Request-cached: Week, Today's morning and the plan page read it once each. */
export const loadWeekRhythm = cache(readWeekRhythm);

/** The week before `weekStart`: its unfinished focus, offered again. */
export async function readCarriedFocus(
	ws: Workspace,
	today: string,
	fmt: Money,
	weekStart: string,
): Promise<DayPick[]> {
	const before = await readWeekPlan(ws.id, addDays(weekStart, -7));
	if (!before?.plannedAt) return [];
	const states = await focusStates(ws, today, fmt, before.focus, before.ticked);
	return states
		.filter((s) => !s.done)
		.map(({ key, title, href, app }) => ({ key, title, href, app }));
}
