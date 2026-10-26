// Keizoku's offline-capable mutations: run the action, or queue it when there's no connection
// (the overlay in lib/overlay.ts shows queued ones until they sync).

import type { KeizokuHabit } from "@/features/keizoku/actions/guard";
import { archiveHabit, unarchiveHabit, updateHabit } from "@/features/keizoku/actions/habits";
import { checkDay, saveDayNote, uncheckDay } from "@/features/keizoku/actions/logs";
import { formatDay } from "@/features/keizoku/lib/constants";
import type { HabitPatch } from "@/features/keizoku/lib/keizoku-schemas";
import { runOrQueue } from "@/features/pwa/lib/run";

type HabitRef = Pick<KeizokuHabit, "id" | "name" | "emoji">;

const tag = (h: HabitRef) => `${h.emoji} ${h.name}`;

export const tickDay = (h: HabitRef, date: string, done: boolean) =>
	done
		? runOrQueue(
				"keizoku.checkDay",
				{ habitId: h.id, date },
				`${tag(h)} · done ${formatDay(date)}`,
				() => checkDay(h.id, date),
			)
		: runOrQueue(
				"keizoku.uncheckDay",
				{ habitId: h.id, date },
				`${tag(h)} · cleared ${formatDay(date)}`,
				() => uncheckDay(h.id, date),
			);

/** The note dialog's FormData; a photo can't wait in the queue, so that needs a connection. */
export function saveNote(h: HabitRef, data: FormData) {
	const file = data.get("photoFile");
	const date = String(data.get("date") ?? "");
	const args = {
		habitId: h.id,
		date,
		note: String(data.get("note") ?? ""),
		removePhoto: data.get("removePhoto") === "1",
	};
	if (file instanceof File && file.size > 0) return saveDayNote(data);
	return runOrQueue("keizoku.saveDayNote", args, `${tag(h)} · note ${formatDay(date)}`, () =>
		saveDayNote(data),
	);
}

export const editHabit = (h: HabitRef, patch: HabitPatch) =>
	runOrQueue("keizoku.updateHabit", { habitId: h.id, patch }, `${tag(h)} · edited`, () =>
		updateHabit(h.id, patch),
	);

export const setArchived = (h: HabitRef, archived: boolean) =>
	archived
		? runOrQueue("keizoku.archiveHabit", { habitId: h.id }, `${tag(h)} · archived`, () =>
				archiveHabit(h.id),
			)
		: runOrQueue("keizoku.unarchiveHabit", { habitId: h.id }, `${tag(h)} · restored`, () =>
				unarchiveHabit(h.id),
			);
