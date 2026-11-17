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
import { createGroup, deleteGroup, updateGroup } from "@/features/seiryu/actions/groups";
import { createLabel, setCardLabels } from "@/features/seiryu/actions/labels";
import { getOpenCardCounts, getProjects } from "@/features/seiryu/actions/projects";
import { getFocus } from "@/features/seiryu/lib/focus-data";
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
const cardLine = (c: Board["cards"][number], board: Board) => ({
	id: c.id,
	title: c.title,
	column: board.columns.find((col) => col.id === c.columnId)?.name,
	group: board.groups.find((g) => g.id === c.groupId)?.name,
	priority: c.priority,
	due: c.dueDate,
	dueTime: c.dueTime ?? undefined,
	hiddenUntil: c.startOn ?? undefined,
	remindMinutesBefore: c.remindMinutes ?? undefined,
	repeat:
		c.repeatEvery && c.repeatUnit
			? `${repeatLabel(c.repeatEvery, c.repeatUnit)}${c.repeatFromDone ? ", from done" : ""}`
			: undefined,
	doneOn: c.doneOn,
	inColumnSince: c.movedAt.slice(0, 10),
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
			"One project's board: columns (id, name, isDone = finish column), groups (headings like a campaign: id, name), labels, and live cards with column, group, priority, due date, labels, checklist progress. Finished cards are archived a week after they're done. Optional filters: column name, group name, q (title text).",
		input: {
			projectId: id,
			column: z.string().optional(),
			group: z.string().optional(),
			q: z.string().optional(),
		},
		run: async ({ projectId, column, group, q }) => {
			const board = await getBoard(projectId);
			if (!board) return NOT_FOUND;
			const cards = board.cards
				.map((c) => cardLine(c, board))
				.filter((c) => !column || c.column?.toLowerCase() === column.toLowerCase())
				.filter((c) => !group || c.group?.toLowerCase() === group.toLowerCase())
				.filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()));
			return {
				columns: board.columns.map((c) => ({ id: c.id, name: c.name, isDone: c.isDone })),
				groups: board.groups.map((g) => ({ id: g.id, name: g.name })),
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
		name: "seiryu_focus",
		title: "Seiryu focus",
		description:
			"What to work on across every project, as Seiryu's Focus page shows it: overdue, due today, in progress (past the first column), and due in the next 7 days. Each card once, with project, group, due, priority, checklist.",
		input: {},
		run: async () => {
			const { today, sections } = await getFocus();
			return {
				today,
				sections: sections.map((s) => ({
					section: s.title,
					cards: s.cards.map((c) => ({
						id: c.id,
						title: c.title,
						project: c.projectName,
						projectId: c.projectId,
						group: c.groupName ?? undefined,
						priority: c.priority ?? undefined,
						due: c.dueDate ?? undefined,
						dueTime: c.dueTime ?? undefined,
						checklist: c.checklist ? `${c.checklist.done}/${c.checklist.total}` : undefined,
					})),
				})),
			};
		},
	}),
	tool({
		name: "seiryu_create_card",
		title: "Create a Seiryu card",
		description:
			"Add a card at the end of a column (ids from seiryu_board), then optionally set group, labels, due date (and time + reminder), priority, description and checklist items. The title is read like the app's: a leading `Group name: …`, `#label` / `#group` words and `!1`–`!4` (low → urgent) sort the card and leave the title — only names that exist in the project. Keep the title short; put steps in `checklist`. Pass a fresh `requestId` (uuid) so a retry never adds it twice.",
		input: {
			projectId: id,
			columnId: id,
			title: z.string().min(1).max(500),
			dueDate: day.optional(),
			dueTime: hhmm.optional(),
			remindMinutes: remind.optional(),
			priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
			groupId: id.optional().describe("A group of the project (seiryu_board)"),
			labelIds: z.array(id).max(20).optional().describe("Labels of the project"),
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
			groupId,
			labelIds,
			description,
			checklist,
			requestId,
		}) => {
			const created = await createCard({
				id: requestId,
				projectId,
				columnId,
				title,
				groupId,
				labelIds,
				priority,
			});
			if ("error" in created) return created;
			const cardId = created.data.id;
			if (dueDate || description) {
				const updated = await updateCard({
					cardId,
					dueDate,
					dueTime: dueDate ? dueTime : undefined,
					remindMinutes: dueDate ? remindMinutes : undefined,
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
			'Change only the given fields. `groupId` moves it into a group of its project (null = none). `startOn` hides it (board, Focus, Today) until that day — "later"; null brings it back. `dueDate`/`dueTime`/`remindMinutes`/`priority`/`description` = null clears it; clearing the date clears its time and reminder. Setting a first time turns a reminder on at that time unless `remindMinutes` is given. `repeatEvery` + `repeatUnit` make it repeat: finishing it creates the next card, due one step later (from its due date, or from the day it\'s done with `repeatFromDone`); null stops it.',
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
			groupId: id.nullable().optional(),
			startOn: day.nullable().optional(),
		},
		write: true,
		idempotent: true,
		run: (input) => updateCard(input),
	}),
	tool({
		name: "seiryu_set_labels",
		title: "Set a card's labels",
		description:
			"Replace a card's labels with these (ids from seiryu_board, of the card's project); [] clears them.",
		input: { cardId: id, labelIds: z.array(id).max(20) },
		write: true,
		idempotent: true,
		run: (input) => setCardLabels(input),
	}),
	tool({
		name: "seiryu_add_checklist_item",
		title: "Add a checklist item",
		description:
			"Add one step at the end of a card's checklist. Pass a fresh `requestId` (uuid) so a retry adds it once.",
		input: { cardId: id, title: z.string().min(1).max(500), requestId: id.optional() },
		write: true,
		idempotent: true,
		run: ({ cardId, title, requestId }) => createChecklistItem({ id: requestId, cardId, title }),
	}),
	tool({
		name: "seiryu_create_group",
		title: "Create a Seiryu group",
		description:
			"A group is a heading inside a project for cards that belong together (a campaign, a release): the board shows it as a chip with its progress. Returns the existing one when the name is taken.",
		input: { projectId: id, name: z.string().min(1).max(60) },
		write: true,
		idempotent: true,
		run: (input) => createGroup(input),
	}),
	tool({
		name: "seiryu_update_group",
		title: "Rename a Seiryu group",
		description: "Rename a group (id from seiryu_board).",
		input: { groupId: id, name: z.string().min(1).max(60) },
		write: true,
		idempotent: true,
		run: (input) => updateGroup(input),
	}),
	tool({
		name: "seiryu_delete_group",
		title: "Delete a Seiryu group",
		description: "Delete a group; its cards stay on the board, in no group.",
		input: { groupId: id },
		write: true,
		idempotent: true,
		run: (input) => deleteGroup(input),
	}),
	tool({
		name: "seiryu_create_label",
		title: "Create a Seiryu label",
		description: "Add a label to a project (a hex colour like #6b7280).",
		input: {
			projectId: id,
			name: z.string().min(1).max(100),
			color: z
				.string()
				.regex(/^#[0-9a-fA-F]{6}$/)
				.default("#6b7280"),
		},
		write: true,
		idempotent: true,
		run: (input) => createLabel(input),
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
