// Kyuu's offline-capable mutations and their overlay: run the action or queue it when there's
// no connection; queuedPatches shows queued ones on the rows until they sync.

import type { OfflineOps, Op } from "@/features/pwa/lib/ops";
import { runOrQueue } from "@/features/pwa/lib/run";
import {
	type EventInput,
	ghostApplications,
	logEvent,
	setArchived,
	setStatus,
} from "../actions/progress";
import { localToday } from "./format";
import type { Status } from "./stages";

type AppRef = { id: string; company: string };

/** Dated today on this device, so a late sync logs it on the day it happened. */
export function changeStatus(app: AppRef, status: Status) {
	const on = localToday();
	return runOrQueue(
		"kyuu.setStatus",
		{ applicationId: app.id, status, on },
		`${app.company} · ${status}`,
		async () => {
			const result = await setStatus(app.id, status, on);
			return "error" in result ? result : { success: true };
		},
	);
}

export function archiveApplication(app: AppRef, archived: boolean) {
	return runOrQueue(
		"kyuu.setArchived",
		{ applicationId: app.id, archived },
		`${app.company} · ${archived ? "archived" : "restored"}`,
		() => setArchived(app.id, archived),
	);
}

/** The toast after closing: the company for one, a count for many. */
export const ghostedText = (count: number, company?: string) =>
	count === 1 && company ? `“${company}” closed as ghosted` : `${count} closed as ghosted`;

/** No answer for long enough: close them as ghosted, dated today on this device. */
export async function ghostAll(ids: string[]) {
	const args = { ids, on: localToday() };
	const label = `${ids.length} closed as ghosted`;
	return runOrQueue("kyuu.ghost", args, label, async () => {
		const result = await ghostApplications(ids, args.on);
		return "error" in result ? result : { success: true };
	});
}

export function addEvent(applicationId: string, label: string, input: EventInput) {
	const event = { ...input, id: crypto.randomUUID() };
	return runOrQueue("kyuu.logEvent", { applicationId, event }, label, async () => {
		const result = await logEvent(applicationId, event);
		return "error" in result ? result : { success: true };
	});
}

export type QueuedPatch = { status?: Status; waiting?: null; hidden?: true };

/** Row changes the queued ops will make, by application id. */
export function queuedPatches(ops: Op[]): Record<string, QueuedPatch> {
	const patches: Record<string, QueuedPatch> = {};
	for (const op of ops) {
		if (op.name === "kyuu.ghost") {
			for (const id of (op.args as OfflineOps["kyuu.ghost"]).ids)
				patches[id] = { ...patches[id], status: "ghosted", waiting: null };
			continue;
		}
		const id = (op.args as { applicationId: string }).applicationId;
		const p: QueuedPatch = patches[id] ?? {};
		if (op.name === "kyuu.setStatus") {
			p.status = (op.args as OfflineOps["kyuu.setStatus"]).status;
			p.waiting = null;
		}
		if (op.name === "kyuu.followUp") p.waiting = null;
		if (op.name === "kyuu.setArchived") p.hidden = true;
		patches[id] = p;
	}
	return patches;
}
