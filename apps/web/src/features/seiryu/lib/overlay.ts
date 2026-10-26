// Seiryu's offline overlay: server cards + queued ops → what the board and the card show.
// Pure, so a change made offline shows right away and after a reload, until the server has it.

import type { OfflineOps, Op } from "@/features/pwa/lib/ops";
import type { CardData, ChecklistItemData } from "@/features/seiryu/lib/types";
import { generateKeyBetween } from "fractional-indexing";

const byPosition = (a: { position: string }, b: { position: string }) =>
	a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

function lastPosition(items: { position: string }[]): string | null {
	return [...items].sort(byPosition).at(-1)?.position ?? null;
}

/** One card's checklist after the queued item ops. */
export function overlayChecklist(
	cardId: string,
	items: ChecklistItemData[],
	ops: Op[],
): ChecklistItemData[] {
	let list = items;
	for (const op of ops) {
		if (op.name === "seiryu.createChecklistItem") {
			const a = op.args as OfflineOps["seiryu.createChecklistItem"];
			if (a.cardId !== cardId || list.some((i) => i.id === a.id)) continue;
			const position = generateKeyBetween(lastPosition(list), null);
			list = [...list, { id: a.id, title: a.title, isCompleted: false, position }];
		}
		if (op.name === "seiryu.toggleChecklistItem") {
			const a = op.args as OfflineOps["seiryu.toggleChecklistItem"];
			list = list.map((i) => (i.id === a.itemId ? { ...i, isCompleted: a.isCompleted } : i));
		}
		if (op.name === "seiryu.updateChecklistItem") {
			const a = op.args as OfflineOps["seiryu.updateChecklistItem"];
			list = list.map((i) => (i.id === a.itemId ? { ...i, title: a.title } : i));
		}
		if (op.name === "seiryu.deleteChecklistItem") {
			const a = op.args as OfflineOps["seiryu.deleteChecklistItem"];
			list = list.filter((i) => i.id !== a.itemId);
		}
	}
	return list;
}

/** One project's open cards after the queued card and checklist ops. */
export function overlayCards(cards: CardData[], ops: Op[], projectId: string): CardData[] {
	if (ops.length === 0) return cards;
	let list = cards;
	for (const op of ops) {
		if (op.name === "seiryu.createCard") {
			const a = op.args as OfflineOps["seiryu.createCard"];
			if (a.projectId !== projectId || list.some((c) => c.id === a.id)) continue;
			const position = generateKeyBetween(
				lastPosition(list.filter((c) => c.columnId === a.columnId)),
				null,
			);
			list = [
				...list,
				{
					id: a.id,
					columnId: a.columnId,
					projectId,
					title: a.title,
					description: null,
					priority: null,
					dueDate: null,
					position,
					checklistItems: [],
					labels: [],
				},
			];
		}
		if (op.name === "seiryu.updateCard") {
			const { cardId, ...updates } = op.args as OfflineOps["seiryu.updateCard"];
			list = list.map((c) => (c.id === cardId ? { ...c, ...updates } : c));
		}
		if (op.name === "seiryu.moveCard") {
			const a = op.args as OfflineOps["seiryu.moveCard"];
			list = list.map((c) => {
				if (c.id !== a.cardId) return c;
				const position =
					a.newPosition ??
					generateKeyBetween(
						lastPosition(list.filter((o) => o.columnId === a.newColumnId && o.id !== c.id)),
						null,
					);
				return { ...c, columnId: a.newColumnId, position };
			});
		}
		if (op.name === "seiryu.reorderCards") {
			const a = op.args as OfflineOps["seiryu.reorderCards"];
			list = list.map((c) => (c.id === a.cardId ? { ...c, position: a.newPosition } : c));
		}
		if (op.name === "seiryu.archiveCard") {
			const a = op.args as OfflineOps["seiryu.archiveCard"];
			list = list.filter((c) => c.id !== a.cardId);
		}
	}
	const checklistOps = ops.filter(
		(o) => o.name.startsWith("seiryu.") && o.name.includes("Checklist"),
	);
	if (checklistOps.length === 0) return list;
	return list.map((c) => {
		const items = overlayChecklist(c.id, c.checklistItems, checklistOps);
		return items === c.checklistItems ? c : { ...c, checklistItems: items };
	});
}
