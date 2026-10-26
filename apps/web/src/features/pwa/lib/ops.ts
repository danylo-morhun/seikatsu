// The mutations that can be queued offline, by name → arguments. Shared by the browser outbox
// (lib/outbox.ts) and the server registry (lib/registry.ts) that replays them.
//
// Rule for adding one: replaying it twice must land the same state (set-style updates,
// creates with a client-made id), because a lost response gets it sent again.

import type { ServiceFormValues } from "@/features/aisha/lib/aisha-schemas";
import type { HabitPatch } from "@/features/keizoku/lib/keizoku-schemas";
import type { TransactionInput } from "@/features/kuroji/actions/transactions";
import type { EventInput } from "@/features/kyuu/actions/progress";
import type { Status } from "@/features/kyuu/lib/stages";
import type { CardFieldUpdates } from "@/features/seiryu/lib/types";
import type { BookStatus } from "@/features/tsundoku/lib/constants";

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
	"seiryu.createCard": { id: string; columnId: string; projectId: string; title: string };
	"seiryu.updateCard": { cardId: string } & CardFieldUpdates;
	"seiryu.moveCard": { cardId: string; newColumnId: string; newPosition?: string };
	"seiryu.reorderCards": { cardId: string; newPosition: string };
	"seiryu.archiveCard": { cardId: string };
	"seiryu.createChecklistItem": { id: string; cardId: string; title: string };
	/** Always the state to set: a flip replayed twice would undo itself. */
	"seiryu.toggleChecklistItem": { itemId: string; isCompleted: boolean };
	"seiryu.updateChecklistItem": { itemId: string; title: string };
	"seiryu.deleteChecklistItem": { itemId: string };
	/** `asOf`: the day it was read, so a late sync logs the pages on the right day. */
	"tsundoku.setProgress": { bookId: string; currentPage: number; asOf: string };
	"tsundoku.updateStatus": { bookId: string; status: BookStatus };
	"tsundoku.updateRating": { bookId: string; rating: number | null };
	"tsundoku.logSession": { bookId: string; id: string; date: string; pagesRead: number };
	"kyuu.setStatus": { applicationId: string; status: Status };
	"kyuu.logEvent": { applicationId: string; event: EventInput & { id: string } };
	"kyuu.followUp": { applicationId: string; id: string; date: string };
	"kyuu.setArchived": { applicationId: string; archived: boolean };
	"aisha.addReading": { vehicleId: string; id: string; date: string; km: number };
	"aisha.logService": { vehicleId: string; values: ServiceFormValues & { id: string } };
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
