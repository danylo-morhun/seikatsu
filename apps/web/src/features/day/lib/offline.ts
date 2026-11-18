// The day's writes from the browser: run now, or kept in the outbox until back online.

import { toast } from "sonner";
import {
	closeDay,
	dropPick,
	savePlan,
	snoozeRow,
	tickPick,
	unsnoozeRow,
} from "@/features/day/actions/day";
import type { DayPick } from "@/features/day/lib/day";
import type { QueueItem } from "@/features/home/lib/queue";
import { QUEUED_TOAST, runOrQueue } from "@/features/pwa/lib/run";
import { saveCard } from "@/features/seiryu/lib/offline";

const quote = (title: string) => `“${title.length > 40 ? `${title.slice(0, 40)}…` : title}”`;

/** "Thu 19 Nov" */
export const shortDay = (day: string) =>
	new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});

/**
 * "Later" on a row: a card moves its own due date (Seiryu's act); anything else is snoozed
 * until that day. `back` brings the row back when it fails or is undone.
 */
export async function putOff(
	item: Pick<QueueItem, "key" | "title" | "cardId">,
	until: string,
	back: () => void,
) {
	const when = shortDay(until);
	if (item.cardId) {
		const result = await saveCard(item.cardId, item.title, { dueDate: until });
		if ("error" in result) {
			toast.error(result.error);
			back();
		} else
			toast("queued" in result ? QUEUED_TOAST : `Moved to ${when}`, { description: item.title });
		return result;
	}
	const args = { key: item.key, until };
	const result = await runOrQueue("day.snooze", args, `Later ${quote(item.title)}`, () =>
		snoozeRow(args),
	);
	if ("error" in result) {
		toast.error(result.error);
		back();
		return result;
	}
	toast("queued" in result ? QUEUED_TOAST : `Later · ${when}`, {
		description: item.title,
		action: {
			label: "Undo",
			onClick: () => {
				back();
				void runOrQueue("day.unsnooze", { key: item.key }, `Back ${quote(item.title)}`, () =>
					unsnoozeRow({ key: item.key }),
				);
			},
		},
	});
	return result;
}

/** A card's "No date": off every list until it gets one again. */
export function clearDue(item: { cardId: string; title: string }) {
	return saveCard(item.cardId, item.title, { dueDate: null, dueTime: null });
}

export function planDay(day: string, picks: DayPick[]) {
	const args = { day, picks };
	return runOrQueue("day.savePlan", args, "Plan the day", () => savePlan(args));
}

export function tick(day: string, pick: DayPick, done: boolean) {
	const args = { day, key: pick.key, done };
	return runOrQueue("day.tick", args, `${done ? "Done" : "Not done"} ${quote(pick.title)}`, () =>
		tickPick(args),
	);
}

export function drop(day: string, pick: DayPick) {
	const args = { day, key: pick.key };
	return runOrQueue("day.drop", args, `Drop ${quote(pick.title)}`, () => dropPick(args));
}

export function close(day: string) {
	return runOrQueue("day.close", { day }, "Close the day", () => closeDay({ day }));
}
