// Server-only: how /api/outbox replays each queued operation. Every entry calls the same
// server action the online path calls, so ownership checks and revalidation live in one place.

import { archiveHabit, unarchiveHabit, updateHabit } from "@/features/keizoku/actions/habits";
import { checkDay, saveDayNote, uncheckDay } from "@/features/keizoku/actions/logs";
import { habitPatchSchema } from "@/features/keizoku/lib/keizoku-schemas";
import type { OfflineOps, OpName, OpResult } from "@/features/pwa/lib/ops";
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type Entry<N extends OpName> = {
	schema: z.ZodType<OfflineOps[N]>;
	run: (args: OfflineOps[N]) => Promise<OpResult>;
};

export const REGISTRY: { [N in OpName]: Entry<N> } = {
	"keizoku.checkDay": {
		schema: z.object({ habitId: z.uuid(), date: day }),
		run: ({ habitId, date }) => checkDay(habitId, date),
	},
	"keizoku.uncheckDay": {
		schema: z.object({ habitId: z.uuid(), date: day }),
		run: ({ habitId, date }) => uncheckDay(habitId, date),
	},
	"keizoku.saveDayNote": {
		schema: z.object({
			habitId: z.uuid(),
			date: day,
			note: z.string().max(2000),
			removePhoto: z.boolean(),
		}),
		run: (args) => {
			// The action takes the dialog's FormData; offline notes never carry a photo.
			const data = new FormData();
			data.set("habitId", args.habitId);
			data.set("date", args.date);
			data.set("note", args.note);
			if (args.removePhoto) data.set("removePhoto", "1");
			return saveDayNote(data);
		},
	},
	"keizoku.updateHabit": {
		schema: z.object({ habitId: z.uuid(), patch: habitPatchSchema }) as z.ZodType<
			OfflineOps["keizoku.updateHabit"]
		>,
		run: ({ habitId, patch }) => updateHabit(habitId, patch),
	},
	"keizoku.archiveHabit": {
		schema: z.object({ habitId: z.uuid() }),
		run: ({ habitId }) => archiveHabit(habitId),
	},
	"keizoku.unarchiveHabit": {
		schema: z.object({ habitId: z.uuid() }),
		run: ({ habitId }) => unarchiveHabit(habitId),
	},
};

/** Validates and runs one queued op. Unknown names and bad args are domain errors, not crashes. */
export async function replay(name: string, args: unknown): Promise<OpResult> {
	const entry = REGISTRY[name as OpName] as Entry<OpName> | undefined;
	if (!entry) return { error: "This change isn't supported anymore." };
	const parsed = entry.schema.safeParse(args);
	if (!parsed.success) return { error: "This change is no longer valid." };
	return entry.run(parsed.data);
}
