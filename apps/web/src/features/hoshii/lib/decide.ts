"use client";

// Keep, let go or undo a want, with the feedback it gets wherever it's done — Hoshii's own
// screens and Today alike: the toast says what happened (and what wasn't spent), Undo puts
// it back, a change kept offline says so.

import { toast } from "sonner";
import { formatMoney } from "@/features/hoshii/lib/format";
import type { MoveTarget } from "@/features/hoshii/lib/hoshii-schemas";
import { sendMove } from "@/features/hoshii/lib/offline";
import { QUEUED_TOAST } from "@/features/pwa/lib/run";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

type Want = { id: string; title: string };

/** Moves the want; on failure calls `onFail` (the caller shows the row again). */
export async function moveWant(
	item: Want,
	to: MoveTarget,
	done: string,
	undoTo: MoveTarget | null,
	onFail?: () => void,
) {
	const result = await sendMove(item, to).catch(() => FAILED);
	if ("error" in result) {
		onFail?.();
		toast.error(result.error);
		return;
	}
	if ("queued" in result) {
		toast(QUEUED_TOAST);
		return;
	}
	if (!undoTo) {
		toast(done);
		return;
	}
	toast(done, {
		action: {
			label: "Undo",
			onClick: () => void sendMove(item, undoTo).then((r) => "error" in r && toast.error(r.error)),
		},
	});
}

/** A cooled want kept: into the Plan. */
export const keepWant = (item: Want, onFail?: () => void) =>
	moveWant(item, "plan", `Kept · ${item.title} joins the Plan`, "cooling", onFail);

/** Let go from where it was (cooling or the Plan); the toast counts what it didn't cost. */
export function releaseWant(
	item: Want & { base: number | null },
	from: MoveTarget,
	currency: string,
	onFail?: () => void,
) {
	const saved = item.base != null ? ` · ${formatMoney(item.base, currency, true)} not spent` : "";
	return moveWant(item, "released", `Let go${saved}`, from, onFail);
}
