// Client: one confirmed action → its app's own offline-capable save. Ownership checks,
// revalidation and offline replay all stay with the app.

import { saveReading } from "@/features/aisha/lib/offline";
import type { PlannedAction } from "@/features/capture/lib/plan";
import { saveNewItem } from "@/features/hoshii/lib/offline";
import { tickDay } from "@/features/keizoku/lib/offline";
import { captureTransaction } from "@/features/kuroji/lib/offline";
import type { RunResult } from "@/features/pwa/lib/run";
import { addCard } from "@/features/seiryu/lib/offline";
import { saveProgress } from "@/features/tsundoku/lib/offline";

type Ctx = { workspaceId: string; columnOf: (projectId: string) => string | undefined };

export async function applyAction(action: PlannedAction, ctx: Ctx): Promise<RunResult> {
	switch (action.kind) {
		case "expense":
		case "income": {
			if (!action.walletId || !action.categoryId) return { error: "Pick a wallet and category" };
			const leg = [{ accountId: action.categoryId, amount: action.amount }];
			const common = {
				currency: action.currency,
				description: action.description || undefined,
				date: action.date,
			};
			return captureTransaction(
				ctx.workspaceId,
				action.kind === "expense"
					? { ...common, fromAccountId: action.walletId, toSplits: leg }
					: { ...common, toAccountId: action.walletId, fromSplits: leg },
			);
		}
		case "mileage":
			return saveReading(action.vehicleId, { date: action.date, km: action.km });
		case "want":
			return saveNewItem({
				title: action.title,
				links: [],
				imageUrl: null,
				price: action.price,
				currency: action.currency,
				listId: null,
				note: null,
			});
		case "card": {
			const columnId = action.projectId ? ctx.columnOf(action.projectId) : undefined;
			if (!action.projectId || !columnId) return { error: "Pick a project" };
			return addCard(crypto.randomUUID(), columnId, action.projectId, action.title);
		}
		case "habit":
			return tickDay(
				{ id: action.habitId, name: action.name, emoji: action.emoji },
				action.date,
				true,
			);
		case "pages":
			return saveProgress({ id: action.bookId, title: action.title }, action.page);
	}
}
