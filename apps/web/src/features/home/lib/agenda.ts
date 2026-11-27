// Everything that waits on the user, read once per request from each app, without a session:
// Today's To do, Week's carried-over items and the morning push are all built from this
// (lib/queue.ts buildQueue turns it into rows). An app that can't be read shows nothing,
// never an error.

import { cache } from "react";
import { readEventsAgenda } from "@/features/calendar/lib/agenda";
import { readSnoozes } from "@/features/day/lib/snoozes";
import { getGoals } from "@/features/goals/lib/data";
import { describeLink, type GoalPace, goalProgress } from "@/features/goals/lib/progress";
import type { QueueData } from "@/features/home/lib/queue";
import { getCardsDue, getWants, readCar } from "@/features/home/lib/today";
import { readMoneyAgenda } from "@/features/kuroji/lib/agenda";
import { readJobsAgenda } from "@/features/kyuu/lib/agenda";
import { type ModuleHref, modulesOn } from "@/lib/modules";
import type { Workspace } from "@/lib/session";

async function safely<T>(load: () => Promise<T>): Promise<T | null> {
	try {
		return await load();
	} catch (e) {
		console.error("[agenda]", e);
		return null;
	}
}

/** Open goals with a date, and how far each has come. */
async function readGoalPace(ws: Workspace, today: string): Promise<GoalPace[]> {
	const goals = await getGoals(ws, today);
	return goals.flatMap((g) =>
		g.targetDate
			? [
					{
						id: g.id,
						name: g.name,
						targetDate: g.targetDate,
						startedOn: g.createdAt.toISOString().slice(0, 10),
						ratio: goalProgress(g.links.map((l) => describeLink(l.reading, () => ""))),
					},
				]
			: [],
	);
}

export async function readAgenda(ws: Workspace, today: string): Promise<QueueData> {
	// A module that's off has nothing waiting.
	const on = modulesOn(ws.modulesOff);
	const from = <T>(module: ModuleHref, load: () => Promise<T>) =>
		on.includes(module) ? safely(load) : Promise.resolve(null);
	const [money, wants, cards, jobs, car, goals, events, snoozed] = await Promise.all([
		from("/kuroji", () => readMoneyAgenda(ws, today)),
		from("/hoshii", () => getWants(ws, today)),
		from("/seiryu", () => getCardsDue(ws, today)),
		from("/kyuu", () => readJobsAgenda(ws.id, today)),
		from("/aisha", () => readCar(ws.id, today)),
		from("/goals", () => readGoalPace(ws, today)),
		// The calendar is the home's own: always on.
		safely(() => readEventsAgenda(ws.id, today)),
		safely(() => readSnoozes(ws.id, today)),
	]);
	return { money, wants, cards, jobs, car, goals, events, snoozed };
}

/** Request-cached for the pages: Today and Week read it once between them. */
export const loadAgenda = cache(readAgenda);
