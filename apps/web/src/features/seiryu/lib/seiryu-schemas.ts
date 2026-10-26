import { z } from "zod";

// ─── Projects ────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
	name: z.string().min(1, "Name is required").max(100),
	description: z.string().max(500).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
		.optional(),
});

export const updateProjectSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const deleteProjectSchema = z.object({
	projectId: z.string().uuid(),
});

export const reorderProjectsSchema = z.object({
	projectId: z.string().uuid(),
	newPosition: z.string().min(1),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ─── Columns ─────────────────────────────────────────────────────────────────

export const createColumnSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string().min(1, "Name is required").max(100),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const updateColumnSchema = z.object({
	columnId: z.string().uuid(),
	name: z.string().trim().min(1).max(100).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.nullable()
		.optional(),
	isDone: z.boolean().optional(),
});

export const deleteColumnSchema = z.object({
	columnId: z.string().uuid(),
	/** Another column of the same project that takes the cards; absent: they go too. */
	moveTo: z.string().uuid().optional(),
});

export const reorderColumnSchema = z.object({
	columnId: z.string().uuid(),
	newPosition: z.string().min(1),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;

// ─── Cards ───────────────────────────────────────────────────────────────────

export const createCardSchema = z.object({
	/** Made on the device, so a replayed (offline) create lands once. */
	id: z.string().uuid().optional(),
	columnId: z.string().uuid(),
	projectId: z.string().uuid(),
	title: z.string().min(1, "Title is required").max(500),
});

export const updateCardSchema = z.object({
	cardId: z.string().uuid(),
	title: z.string().min(1).max(500).optional(),
	description: z.string().max(5000).nullable().optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).nullable().optional(),
	dueDate: z.string().nullable().optional(),
});

export const archiveCardSchema = z.object({
	cardId: z.string().uuid(),
});

export const moveCardSchema = z.object({
	cardId: z.string().uuid(),
	newColumnId: z.string().uuid(),
	/** Omitted: the card goes to the end of the column. */
	newPosition: z.string().min(1).optional(),
});

export const reorderCardSchema = z.object({
	cardId: z.string().uuid(),
	newPosition: z.string().min(1),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

// ─── Checklist ────────────────────────────────────────────────────────────────

export const createChecklistItemSchema = z.object({
	/** Made on the device, so a replayed (offline) create lands once. */
	id: z.string().uuid().optional(),
	cardId: z.string().uuid(),
	title: z.string().min(1, "Title is required").max(500),
});

export const updateChecklistItemSchema = z.object({
	itemId: z.string().uuid(),
	title: z.string().trim().min(1, "Title is required").max(500),
});

export const toggleChecklistItemSchema = z.object({
	itemId: z.string().uuid(),
	/** The state to set. Omitted flips it — not safe to replay, so offline sends it. */
	isCompleted: z.boolean().optional(),
});

export const deleteChecklistItemSchema = z.object({
	itemId: z.string().uuid(),
});

export const reorderChecklistItemSchema = z.object({
	itemId: z.string().uuid(),
	newPosition: z.string().min(1),
});

// ─── Labels ──────────────────────────────────────────────────────────────────

export const createLabelSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string().min(1, "Name is required").max(100),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
});

export const updateLabelSchema = z.object({
	labelId: z.string().uuid(),
	name: z.string().trim().min(1, "Name is required").max(100).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
		.optional(),
});

export const deleteLabelSchema = z.object({
	labelId: z.string().uuid(),
});

export const setCardLabelsSchema = z.object({
	cardId: z.string().uuid(),
	labelIds: z.array(z.string().uuid()),
});

export const restoreCardSchema = z.object({ cardId: z.string().uuid() });
export const deleteCardSchema = z.object({ cardId: z.string().uuid() });
