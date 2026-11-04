"use client";

// Finishing a card, with the feedback it gets wherever it's done — the board's X and Today's
// Done alike: into the project's first finish column, a toast with Undo that puts it back
// where it was, and a note when the change waits offline.

import { toast } from "sonner";
import { QUEUED_TOAST } from "@/features/pwa/lib/run";
import { placeCard } from "@/features/seiryu/lib/offline";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

type Spot = { columnId: string; position: string };

/**
 * Moves the card to `doneColumnId` (at its end). `from` is where it was, for Undo; `onFail`
 * and `onUndo` let the caller show it again.
 */
export async function finishCard(
	card: { id: string; title: string },
	doneColumnId: string,
	from: Spot,
	handlers: { onFail?: () => void; onUndo?: (spot: Spot) => void } = {},
) {
	const result = await placeCard(card.id, card.title, { columnId: doneColumnId }).catch(
		() => FAILED,
	);
	if ("error" in result) {
		handlers.onFail?.();
		toast.error(result.error);
		return result;
	}
	if ("queued" in result) {
		toast(QUEUED_TOAST);
		return result;
	}
	toast("Done", {
		description: card.title,
		action: {
			label: "Undo",
			onClick: () =>
				void placeCard(card.id, card.title, { ...from }).then((r) =>
					"error" in r ? toast.error(r.error) : handlers.onUndo?.(from),
				),
		},
	});
	return result;
}
