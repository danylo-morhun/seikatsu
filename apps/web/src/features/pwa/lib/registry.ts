// Server-only: how /api/outbox replays each queued operation. Every entry calls the same
// server action the online path calls, so ownership checks and revalidation live in one place.

import { archiveHabit, unarchiveHabit, updateHabit } from "@/features/keizoku/actions/habits";
import { checkDay, saveDayNote, uncheckDay } from "@/features/keizoku/actions/logs";
import { habitPatchSchema } from "@/features/keizoku/lib/keizoku-schemas";
import {
	createTransaction,
	deleteTransaction,
	updateTransaction,
} from "@/features/kuroji/actions/transactions";
import type { OfflineOps, OpName, OpResult } from "@/features/pwa/lib/ops";
import {
	archiveCard,
	createCard,
	moveCard,
	reorderCards,
	updateCard,
} from "@/features/seiryu/actions/cards";
import {
	createChecklistItem,
	deleteChecklistItem,
	toggleChecklistItem,
	updateChecklistItem,
} from "@/features/seiryu/actions/checklist";
import {
	archiveCardSchema,
	createCardSchema,
	createChecklistItemSchema,
	deleteChecklistItemSchema,
	moveCardSchema,
	reorderCardSchema,
	updateCardSchema,
	updateChecklistItemSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const money = z.number().finite().positive().max(1e12);
const legs = z.array(z.object({ accountId: z.uuid(), amount: money })).max(50);
// The capture form's payload (TransactionInput); the action checks accounts and tags belong.
const transactionInput = z.object({
	fromAccountId: z.uuid().optional(),
	toAccountId: z.uuid().optional(),
	amount: money.optional(),
	toSplits: legs.optional(),
	fromSplits: legs.optional(),
	currency: z.string().regex(/^[A-Z]{3}$/),
	received: money.optional(),
	description: z.string().max(500).optional(),
	date: day,
	tagIds: z.array(z.uuid()).max(50).optional(),
});

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
	"kuroji.createTransaction": {
		schema: transactionInput.extend({ workspaceId: z.uuid(), id: z.uuid() }),
		run: (args) => createTransaction(args),
	},
	"kuroji.updateTransaction": {
		schema: transactionInput.extend({ transactionId: z.uuid() }),
		run: (args) => updateTransaction(args),
	},
	"kuroji.deleteTransaction": {
		schema: z.object({ transactionId: z.uuid() }),
		run: async ({ transactionId }) => {
			// Already gone (deleted before the response got lost) is what was asked for.
			const result = await deleteTransaction(transactionId);
			return "error" in result && result.error === "Transaction not found"
				? { success: true }
				: result;
		},
	},
	// Seiryu's actions parse their own input; these schemas are the same ones, ids required.
	"seiryu.createCard": {
		schema: createCardSchema.extend({ id: z.uuid() }),
		run: async (args) => {
			const result = await createCard(args);
			return "error" in result ? result : { success: true };
		},
	},
	"seiryu.updateCard": {
		schema: updateCardSchema as z.ZodType<OfflineOps["seiryu.updateCard"]>,
		run: (args) => updateCard(args),
	},
	"seiryu.moveCard": {
		schema: moveCardSchema,
		run: async (args) => {
			const result = await moveCard(args);
			return "error" in result ? result : { success: true };
		},
	},
	"seiryu.reorderCards": { schema: reorderCardSchema, run: (args) => reorderCards(args) },
	"seiryu.archiveCard": { schema: archiveCardSchema, run: (args) => archiveCard(args) },
	"seiryu.createChecklistItem": {
		schema: createChecklistItemSchema.extend({ id: z.uuid() }),
		run: async (args) => {
			const result = await createChecklistItem(args);
			return "error" in result ? result : { success: true };
		},
	},
	"seiryu.toggleChecklistItem": {
		schema: z.object({ itemId: z.uuid(), isCompleted: z.boolean() }),
		run: (args) => toggleChecklistItem(args),
	},
	"seiryu.updateChecklistItem": {
		schema: updateChecklistItemSchema,
		run: (args) => updateChecklistItem(args),
	},
	"seiryu.deleteChecklistItem": {
		schema: deleteChecklistItemSchema,
		run: async (args) => {
			// Already gone is what was asked for.
			const result = await deleteChecklistItem(args);
			return "error" in result && result.error === "Item not found" ? { success: true } : result;
		},
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
