// Kyuu's offline-capable mutations and their overlay: run the action or queue it when there's
// no connection; queuedPatches shows queued ones on the rows until they sync.

import type { OfflineOps, Op } from "@/features/pwa/lib/ops";
import { runOrQueue } from "@/features/pwa/lib/run";
import { type EventInput, followUp, logEvent, setArchived, setStatus } from "../actions/progress";
import { localToday } from "./format";
import type { Status } from "./stages";

type AppRef = { id: string; company: string };

export function changeStatus(app: AppRef, status: Status) {
	return runOrQueue(
		"kyuu.setStatus",
		{ applicationId: app.id, status },
		`${app.company} · ${status}`,
		async () => {
			const result = await setStatus(app.id, status);
			return "error" in result ? result : { success: true };
		},
	);
}

/** Its id and day are made here, so a late sync logs it once, on the day it was sent. */
export function logFollowUp(app: AppRef) {
	const args = { applicationId: app.id, id: crypto.randomUUID(), date: localToday() };
	return runOrQueue("kyuu.followUp", args, `${app.company} · followed up`, () =>
		followUp(app.id, { id: args.id, date: args.date }),
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
