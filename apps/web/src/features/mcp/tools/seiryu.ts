import { z } from "zod";
import { getCardsDue } from "@/features/home/lib/today";
import {
	archiveCard,
	createCard,
	getBoard,
	getCard,
	moveCard,
	updateCard,
} from "@/features/seiryu/actions/cards";
import { createChecklistItem, toggleChecklistItem } from "@/features/seiryu/actions/checklist";
import { getOpenCardCounts, getProjects } from "@/features/seiryu/actions/projects";
import { repeatLabel } from "@/features/seiryu/lib/repeat";
import { day } from "./shell";
import { tool } from "./types";

const id = z.uuid();
const hhmm = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
	.describe("Local time HH:MM on the due day (needs a due date)");
const remind = z
	.number()
	.int()
	.min(0)
	.max(10080)
	.describe(
		"Push a reminder this many minutes before the due moment (its time, else 09:00); 0 = at the time",
	);
const NOT_FOUND = { error: "Not found" };

type Board = NonNullable<Awaited<ReturnType<typeof getBoard>>>;
const cardLine = (c: Board["cards"][number], columns: Board["columns"]) => ({
	id: c.id,
	title: c.title,
	column: columns.find((col) => col.id === c.columnId)?.name,
	priority: c.priority,
	due: c.dueDate,
	dueTime: c.dueTime ?? undefined,
	remindMinutesBefore: c.remindMinutes ?? undefined,
	repeat:
		c.repeatEvery && c.repeatUnit
			? `${repeatLabel(c.repeatEvery, c.repeatUnit)}${c.repeatFromDone ? ", from done" : ""}`
			: undefined,
	doneOn: c.doneOn,
	labels: c.labels.map((l) => l.name),
	checklist: c.checklistItems.length
		? `${c.checklistItems.filter((i) => i.isCompleted).length}/${c.checklistItems.length}`
		: undefined,
	hasDescription: c.hasDescription || undefined,
});

/** The card's project's first finish column — where the board's X sends it. */
async function doneColumnOf(cardId: string) {
	const card = await getCard(cardId);
	if (!card) return null;
	const board = await getBoard(card.projectId);
	const done = board?.columns.find((c) => c.isDone);
	return done ? { card, done } : null;
}

export const seiryuTools = [
	tool({
		name: "seiryu_projects",
		title: "Seiryu projects",
		description: "Kanban projects with ids and how many open cards each has.",
		input: {},
		run: async () => {
			const [projects, open] = await Promise.all([getProjects(), getOpenCardCounts()]);
			return projects.map((p) => ({
				id: p.id,
				name: p.name,
				description: p.description,
				openCards: open[p.id] ?? 0,
			}));
		},
	}),
	tool({
		name: "seiryu_board",
		title: "Seiryu board",
		description:
			"One project's board: columns (id, name, isDone = finish column) and live cards with column, priority, due date, labels, checklist progress. Optional filters: column name, q (title text).",
		input: { projectId: id, column: z.string().optional(), q: z.string().optional() },
		run: async ({ projectId, column, q }) => {
			const board = await getBoard(projectId);
			if (!board) return NOT_FOUND;
			const cards = board.cards
				.map((c) => cardLine(c, board.columns))
				.filter((c) => !column || c.column?.toLowerCase() === column.toLowerCase())
				.filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()));
			return {
				columns: board.columns.map((c) => ({ id: c.id, name: c.name, isDone: c.isDone })),
				labels: board.labels.map((l) => ({ id: l.id, name: l.name })),
				cards,
				archivedTotal: board.archivedTotal,
			};
		},
	}),
	tool({
		name: "seiryu_card",
		title: "Seiryu card",
		description: "One card in full: description, checklist items (with ids), labels, dates.",
		input: { cardId: id },
		run: async ({ cardId }) => (await getCard(cardId)) ?? NOT_FOUND,
	}),
	tool({
		name: "seiryu_due",
		title: "Seiryu cards due",
		description:
			"Open cards with a due date, across all projects, as Today counts them (overdue and soon).",
		input: {},
		run: (_a, { ws, today }) => getCardsDue(ws, today),
	}),
	tool({
		name: "seiryu_create_card",
		title: "Create a Seiryu card",
		description:
			"Add a card at the end of a column (ids from seiryu_board), then optionally set due date (and time + reminder), priority, description and checklist items. Pass a fresh `requestId` (uuid) so a retry never adds it twice.",
		input: {
			projectId: id,
			columnId: id,
			title: z.string().min(1).max(500),
			dueDate: day.optional(),
			dueTime: hhmm.optional(),
			remindMinutes: remind.optional(),
			priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
			description: z.string().max(5000).optional(),
			checklist: z.array(z.string().min(1).max(500)).max(30).optional(),
			requestId: id.optional(),
		},
		write: true,
		idempotent: true,
		run: async ({
			projectId,
			columnId,
			title,
			dueDate,
			dueTime,
			remindMinutes,
			priority,
			description,
			checklist,
			requestId,
		}) => {
			const created = await createCard({ id: requestId, projectId, columnId, title });
			if ("error" in created) return created;
			const cardId = created.data.id;
			if (dueDate || priority || description) {
				const updated = await updateCard({
					cardId,
					dueDate,
					dueTime: dueDate ? dueTime : undefined,
					remindMinutes: dueDate ? remindMinutes : undefined,
					priority,
					description,
				});
				if ("error" in updated) return updated;
			}
			for (const item of checklist ?? []) {
				const added = await createChecklistItem({ cardId, title: item });
				if ("error" in added) return added;
			}
			return { id: cardId };
		},
	}),
	tool({
		name: "seiryu_update_card",
		title: "Update a Seiryu card",
		description:
			"Change only the given fields. `dueDate`/`dueTime`/`remindMinutes`/`priority`/`description` = null clears it; clearing the date clears its time and reminder. Setting a first time turns a reminder on at that time unless `remindMinutes` is given. `repeatEvery` + `repeatUnit` make it repeat: finishing it creates the next card, due one step later (from its due date, or from the day it's done with `repeatFromDone`); null stops it.",
		input: {
			cardId: id,
			title: z.string().min(1).max(500).optional(),
			description: z.string().max(5000).nullable().optional(),
			priority: z.enum(["low", "medium", "high", "urgent"]).nullable().optional(),
			dueDate: day.nullable().optional(),
			dueTime: hhmm.nullable().optional(),
			remindMinutes: remind.nullable().optional(),
			repeatEvery: z.number().int().min(1).max(365).nullable().optional(),
			repeatUnit: z.enum(["day", "week", "month", "year"]).nullable().optional(),
			repeatFromDone: z.boolean().optional(),
		},
		write: true,
		idempotent: true,
		run: (input) => updateCard(input),
	}),
	tool({
		name: "seiryu_move_card",
		title: "Move a Seiryu card",
		description: "Move a card to the end of another column of its project.",
		input: { cardId: id, columnId: id },
		write: true,
		idempotent: true,
		run: ({ cardId, columnId }) => moveCard({ cardId, newColumnId: columnId }),
	}),
	tool({
		name: "seiryu_finish_card",
		title: "Finish a Seiryu card",
		description: "Mark a card done: into its project's finish column, as the board's X does.",
		input: { cardId: id },
		write: true,
		idempotent: true,
		run: async ({ cardId }) => {
			const found = await doneColumnOf(cardId);
			if (!found) return { error: "Card not found, or its project has no finish column" };
			if (found.card.columnId === found.done.id) return { success: true, alreadyDone: true };
			return moveCard({ cardId, newColumnId: found.done.id });
		},
	}),
	tool({
		name: "seiryu_archive_card",
		title: "Archive a Seiryu card",
		description: "Archive a card (it can be restored in the app).",
		input: { cardId: id },
		write: true,
		idempotent: true,
		run: ({ cardId }) => archiveCard({ cardId }),
	}),
	tool({
		name: "seiryu_check_item",
		title: "Tick a checklist item",
		description: "Set a checklist item (id from seiryu_card) done or not done.",
		input: { itemId: id, done: z.boolean().default(true) },
		write: true,
		idempotent: true,
		run: ({ itemId, done }) => toggleChecklistItem({ itemId, isCompleted: done }),
	}),
];
