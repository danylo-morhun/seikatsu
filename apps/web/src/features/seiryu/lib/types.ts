import type { Priority } from "@/features/seiryu/lib/constants";
import type { RepeatUnit } from "@/features/seiryu/lib/repeat";

export type ChecklistItemData = {
	id: string;
	title: string;
	isCompleted: boolean;
	position: string;
	/** Client-only: the temp id it was added under; a stable key, and it drops in once. */
	clientKey?: string;
};

export type LabelData = {
	id: string;
	name: string;
	color: string;
};

export type ColumnData = {
	id: string;
	projectId: string;
	name: string;
	color: string | null;
	/** The finish line: its cards count as finished, not open. */
	isDone: boolean;
	position: string;
};

export type ColumnUpdates = Partial<Pick<ColumnData, "name" | "color" | "isDone">>;

export type CardData = {
	id: string;
	columnId: string;
	projectId: string;
	title: string;
	/** Undefined on the board, which leaves the text on the server until the card opens. */
	description?: string | null;
	/** Whether it has a description, loaded or not: the board's note marker. */
	hasDescription: boolean;
	priority: Priority | null;
	dueDate: string | null;
	/** "HH:MM" on the due day, or null for any time. */
	dueTime: string | null;
	/** Minutes before the due moment; null = no reminder. */
	remindMinutes: number | null;
	/** Repeats every N units (null = once); finishing it makes the next card. */
	repeatEvery: number | null;
	repeatUnit: RepeatUnit | null;
	repeatFromDone: boolean;
	/** ISO instant it last changed column. */
	movedAt: string;
	position: string;
	checklistItems: ChecklistItemData[];
	labels: LabelData[];
	/** Client-only: the temp id a card was created under, kept as its React key once saved. */
	clientKey?: string;
};

export type CardFieldUpdates = Partial<
	Pick<
		CardData,
		| "title"
		| "description"
		| "priority"
		| "dueDate"
		| "dueTime"
		| "remindMinutes"
		| "repeatEvery"
		| "repeatUnit"
		| "repeatFromDone"
	>
>;

/** The card with saved field changes; a new description moves its marker too. */
export function withCardUpdates(card: CardData, updates: CardFieldUpdates): CardData {
	return "description" in updates
		? { ...card, ...updates, hasDescription: !!updates.description }
		: { ...card, ...updates };
}

export type ActionResult = { error: string } | { success: true };

/** Not saved yet: shown at once, but can't be opened, dragged or edited until the server answers. */
export const isTempId = (id: string) => id.startsWith("temp-");

/** Days in one in-progress column before a card is shown as stuck. */
export const STUCK_DAYS = 7;

/** Whole days since `movedAt` when that's STUCK_DAYS or more, else null. */
export function stuckDays(movedAt: string, now: number = Date.now()): number | null {
	const days = Math.floor((now - Date.parse(movedAt)) / 86_400_000);
	return days >= STUCK_DAYS ? days : null;
}
