// Seiryu's offline-capable mutations: run the action, or queue it when there's no connection
// (lib/overlay.ts shows queued ones on the board and in the card until they sync).
// Creates carry an id made here, so a queued card or item is real (openable, editable) at once.

import { runOrQueue } from "@/features/pwa/lib/run";
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
import type { CardFieldUpdates } from "@/features/seiryu/lib/types";

const quote = (title: string) => `“${title.length > 40 ? `${title.slice(0, 40)}…` : title}”`;

export function addCard(id: string, columnId: string, projectId: string, title: string) {
	const args = { id, columnId, projectId, title };
	return runOrQueue("seiryu.createCard", args, `New card ${quote(title)}`, async () => {
		const result = await createCard(args);
		return "error" in result ? result : { success: true };
	});
}

export function saveCard(cardId: string, title: string, updates: CardFieldUpdates) {
	const args = { cardId, ...updates };
	return runOrQueue("seiryu.updateCard", args, `Edit ${quote(title)}`, () => updateCard(args));
}

export function placeCard(
	cardId: string,
	title: string,
	to: { columnId: string; position?: string; sameColumn?: boolean },
) {
	if (to.sameColumn && to.position) {
		const args = { cardId, newPosition: to.position };
		return runOrQueue("seiryu.reorderCards", args, `Reorder ${quote(title)}`, () =>
			reorderCards(args),
		);
	}
	const args = { cardId, newColumnId: to.columnId, newPosition: to.position };
	return runOrQueue("seiryu.moveCard", args, `Move ${quote(title)}`, async () => {
		const result = await moveCard(args);
		return "error" in result ? result : { success: true };
	});
}

export function shelveCard(cardId: string, title: string) {
	return runOrQueue("seiryu.archiveCard", { cardId }, `Archive ${quote(title)}`, () =>
		archiveCard({ cardId }),
	);
}

export function addChecklistItem(id: string, cardId: string, title: string) {
	const args = { id, cardId, title };
	return runOrQueue(
		"seiryu.createChecklistItem",
		args,
		`Checklist: add ${quote(title)}`,
		async () => {
			const result = await createChecklistItem(args);
			return "error" in result ? result : { success: true };
		},
	);
}

export function setChecklistItem(itemId: string, title: string, isCompleted: boolean) {
	const args = { itemId, isCompleted };
	return runOrQueue(
		"seiryu.toggleChecklistItem",
		args,
		`Checklist: ${isCompleted ? "done" : "undone"} ${quote(title)}`,
		() => toggleChecklistItem(args),
	);
}

export function renameChecklistItem(itemId: string, title: string) {
	const args = { itemId, title };
	return runOrQueue("seiryu.updateChecklistItem", args, `Checklist: rename ${quote(title)}`, () =>
		updateChecklistItem(args),
	);
}

export function removeChecklistItem(itemId: string, title: string) {
	return runOrQueue(
		"seiryu.deleteChecklistItem",
		{ itemId },
		`Checklist: delete ${quote(title)}`,
		() => deleteChecklistItem({ itemId }),
	);
}
