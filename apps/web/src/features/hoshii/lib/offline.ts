// Hoshii's offline-capable mutations: run the action or queue it when there's no connection.

import { localToday } from "@/features/aisha/lib/today";
import { createItem, moveItem, reorderPlan } from "@/features/hoshii/actions/items";
import type { ItemFormValues, MoveTarget } from "@/features/hoshii/lib/hoshii-schemas";
import { runOrQueue } from "@/features/pwa/lib/run";

const VERB: Record<MoveTarget, string> = { plan: "Keep", released: "Let go", cooling: "Undo" };

/** Its id is made here, so a replay lands once. */
export function saveNewItem(values: ItemFormValues) {
	const args = { ...values, id: crypto.randomUUID() };
	return runOrQueue("hoshii.createItem", args, `Want · ${values.title}`, async () => {
		const result = await createItem(args);
		return "error" in result ? result : { success: true as const };
	});
}

/** Keep, let go or undo, dated today on this device. */
export function sendMove(item: { id: string; title: string }, to: MoveTarget) {
	const args = { itemId: item.id, to, on: localToday() };
	return runOrQueue("hoshii.moveItem", args, `${VERB[to]} · ${item.title}`, () =>
		moveItem(args.itemId, to, args.on),
	);
}

export function sendReorder(item: { id: string; title: string }, position: string) {
	return runOrQueue(
		"hoshii.reorderPlan",
		{ itemId: item.id, position },
		`Plan order · ${item.title}`,
		() => reorderPlan(item.id, position),
	);
}

/** The toast for a change kept on this device. */
export const QUEUED_TOAST = "Saved on this device. It syncs when you're back online.";
