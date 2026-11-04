// Everything that waits on the user, read once per request from each app, without a session:
// Today's To do, Week's carried-over items and the morning push are all built from this
// (lib/queue.ts buildQueue turns it into rows). An app that can't be read shows nothing,
// never an error.

import { cache } from "react";
import type { QueueData } from "@/features/home/lib/queue";
import { getCardsDue, getWants, readCar } from "@/features/home/lib/today";
import { readMoneyAgenda } from "@/features/kuroji/lib/agenda";
import { readJobsAgenda } from "@/features/kyuu/lib/agenda";
import type { Workspace } from "@/lib/session";

async function safely<T>(load: () => Promise<T>): Promise<T | null> {
	try {
		return await load();
	} catch (e) {
		console.error("[agenda]", e);
		return null;
	}
}

export async function readAgenda(ws: Workspace, today: string): Promise<QueueData> {
	const [money, wants, cards, jobs, car] = await Promise.all([
		safely(() => readMoneyAgenda(ws, today)),
		safely(() => getWants(ws, today)),
		safely(() => getCardsDue(ws, today)),
		safely(() => readJobsAgenda(ws.id, today)),
		safely(() => readCar(ws.id, today)),
	]);
	return { money, wants, cards, jobs, car };
}

/** Request-cached for the pages: Today and Week read it once between them. */
export const loadAgenda = cache(readAgenda);
