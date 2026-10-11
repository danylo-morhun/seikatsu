import type { Priority } from "@/features/seiryu/lib/constants";

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
	description: string | null;
	priority: Priority | null;
	dueDate: string | null;
	position: string;
	checklistItems: ChecklistItemData[];
	labels: LabelData[];
	/** Client-only: the temp id a card was created under, kept as its React key once saved. */
	clientKey?: string;
};

export type CardFieldUpdates = Partial<
	Pick<CardData, "title" | "description" | "priority" | "dueDate">
>;

export type ActionResult = { error: string } | { success: true };

/** Not saved yet: shown at once, but can't be opened, dragged or edited until the server answers. */
export const isTempId = (id: string) => id.startsWith("temp-");
