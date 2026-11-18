// The week's plan, read: which week is due for planning, its focus and how far each item has
// come (the day's rules: a card when finished, a row when gone, the user's words when ticked).
// Plain server module.

import { and, dayPlans, db, eq, gte, lte, type WeekPlan, weekPlans } from "@seikatsu/db";
import { cache } from "react";
import { getUserMinutes, type PickRow, readEvening, readOpenCards } from "@/features/day/lib/data";
import { cardIdOf, type DayPick, pickStates } from "@/features/day/lib/day";
import { getGoals } from "@/features/goals/lib/data";
import { describeLink, goalAttention, goalProgress } from "@/features/goals/lib/progress";
import { readGoalProjects, readNextSteps } from "@/features/goals/lib/steps";
import { loadAgenda } from "@/features/home/lib/agenda";
import { buildQueue, type Money } from "@/features/home/lib/queue";
import { addDays } from "@/features/seiryu/lib/filters";
import { getFocus } from "@/features/seiryu/lib/focus-data";
import { focusCandidates, mondayOf, planTarget, weekPhase } from "@/features/week/lib/rhythm";
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

export type GoalNeed = { name: string; why: string };

/**
 * What the week can focus on and what the look back shows about goals: last week's leftovers,
 * each goal's next step (those asking for attention first), cards under way and due soon.
 */
export async function readFocusOptions(ws: Workspace, today: string, fmt: Money, target: string) {
	const [carried, goals, focus, goalProjects] = await Promise.all([
		readCarriedFocus(ws, today, fmt, target),
		getGoals(ws, today),
		getFocus().catch(() => null),
		readGoalProjects(ws.id),
	]);
	const projectIds = goals.flatMap((g) =>
		g.links.flatMap((l) => (l.kind === "project" && l.refId ? [l.refId] : [])),
	);
	const steps = await readNextSteps(ws.id, projectIds);
	const paced = goals.map((g) => {
		const ratio = goalProgress(g.links.map((l) => describeLink(l.reading, fmt)));
		const why = goalAttention(
			{
				id: g.id,
				name: g.name,
				targetDate: g.targetDate,
				startedOn: g.createdAt.toISOString().slice(0, 10),
				ratio,
			},
			today,
		);
		const card = g.links
			.flatMap((l) => (l.kind === "project" && l.refId ? [steps.get(l.refId)?.card] : []))
			.find(Boolean);
		return { goal: g, why, card };
	});
	const needs: GoalNeed[] = paced.flatMap(({ goal, why, card }) =>
		why
			? [{ name: goal.name, why: GOAL_WHY[why] }]
			: !card && goal.links.some((l) => l.kind === "project")
				? [{ name: goal.name, why: "No next step" }]
				: [],
	);
	const goalSteps = [...paced]
		.sort((a, b) => Number(Boolean(b.why)) - Number(Boolean(a.why)))
		.flatMap(({ goal, why, card }) =>
			card
				? [
						{
							key: `seiryu:${card.id}`,
							title: card.title,
							href: `/seiryu/${card.projectId}/${card.id}`,
							app: "/seiryu",
							goal: goal.name,
							note: why ? `Next step · ${GOAL_WHY[why].toLowerCase()}` : "Next step",
						},
					]
				: [],
		);
	const cardsOf = (key: "doing" | "soon") =>
		(focus?.sections.find((s) => s.key === key)?.cards ?? []).map((c) => ({
			key: `seiryu:${c.id}`,
			title: c.title,
			href: `/seiryu/${c.projectId}/${c.id}`,
			app: "/seiryu",
			note:
				key === "doing"
					? `${c.projectName} · in progress`
					: `${c.projectName} · due ${c.dueDate ?? ""}`,
			goal: goalProjects.get(c.projectId) ?? null,
		}));
	return {
		candidates: focusCandidates({
			carried,
			goalSteps,
			doing: cardsOf("doing"),
			soon: cardsOf("soon"),
		}),
		needs,
	};
}

const GOAL_WHY = {
	soon: "Its day is close",
	behind: "Behind its pace",
	over: "Its day has passed",
};
