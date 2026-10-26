// The mutations that can be queued offline, by name → arguments. Shared by the browser outbox
// (lib/outbox.ts) and the server registry (lib/registry.ts) that replays them.
//
// Rule for adding one: replaying it twice must land the same state (set-style updates,
// creates with a client-made id), because a lost response gets it sent again.

import type { HabitPatch } from "@/features/keizoku/lib/keizoku-schemas";
import type { TransactionInput } from "@/features/kuroji/actions/transactions";

export interface OfflineOps {
	"keizoku.checkDay": { habitId: string; date: string };
	"keizoku.uncheckDay": { habitId: string; date: string };
	"keizoku.saveDayNote": { habitId: string; date: string; note: string; removePhoto: boolean };
	"keizoku.updateHabit": { habitId: string; patch: HabitPatch };
	"keizoku.archiveHabit": { habitId: string };
	"keizoku.unarchiveHabit": { habitId: string };
	/** `id` is made on the device, so later edits of an offline capture can point at it. */
	"kuroji.createTransaction": TransactionInput & { workspaceId: string; id: string };
	"kuroji.updateTransaction": TransactionInput & { transactionId: string };
	"kuroji.deleteTransaction": { transactionId: string };
}

export type OpName = keyof OfflineOps;

export type OpResult = { error: string } | { success: true };

export interface Op<N extends OpName = OpName> {
	opId: string;
	name: N;
	args: OfflineOps[N];
	/** What it was, for the "not synced" list: "🏃 Run · done 25 Oct". */
	label: string;
	createdAt: number;
	/** synced: applied on the server, kept until the refreshed page shows it (no flicker). */
	status: "pending" | "synced" | "failed";
	error?: string;
}
