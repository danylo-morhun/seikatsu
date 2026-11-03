// Server-only reads for 志 Goals: the goals with each link read from its app, and what can be
// linked. Not a "use server" module — import only from server components and actions.

import {
	and,
	asc,
	count,
	db,
	eq,
	type Goal,
	type GoalLink,
	goalLinks,
	goals,
	gte,
	hoshiiItems,
	hoshiiLists,
	inArray,
	isNull,
	keizokuHabitLogs,
	keizokuHabits,
	kurojiFunds,
	kyuuApplications,
	kyuuEvents,
	notInArray,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
	tsundokuBookShelves,
	tsundokuBooks,
	tsundokuShelves,
} from "@seikatsu/db";
import {
	HABIT_DAYS,
	JOB_DAYS,
	type LinkKind,
	type LinkReading,
} from "@/features/goals/lib/progress";
import { addDays, isScheduled, lastDays } from "@/features/keizoku/lib/streak";
import { getBalances } from "@/features/kuroji/actions/balances";
import { displayBalance } from "@/features/kuroji/lib/balance";
import { allocateFunds } from "@/features/kuroji/lib/plan";

export type GoalWithLinks = Goal & { links: (GoalLink & { reading: LinkReading })[] };

/** What each kind can link to: the workspace's own containers, by name. */
export type LinkOptions = Record<Exclude<LinkKind, "jobs">, { id: string; name: string }[]>;

const ids = (links: GoalLink[], kind: LinkKind) =>
	links.flatMap((l) => (l.kind === kind && l.refId ? [l.refId] : []));

/** Kuroji's funds, each filled from its account the way the Plan tab fills them. */
async function readFunds(
	ws: { id: string; baseCurrency: string },
	refIds: string[],
	today: string,
) {
	if (refIds.length === 0) return new Map<string, LinkReading>();
	const [funds, balances] = await Promise.all([
		db
			.select()
			.from(kurojiFunds)
			.where(eq(kurojiFunds.workspaceId, ws.id))
			.orderBy(asc(kurojiFunds.dueDate)),
		getBalances(ws.id, undefined, today),
	]);
	const now = new Map(
		balances
			.filter((b) => b.type === "ASSET")
			.map((b) => [b.accountId, displayBalance("ASSET", Number(b.balance))]),
	);
	const filled = allocateFunds(
		funds.map((f) => ({
			id: f.id,
			name: f.name,
			accountId: f.accountId,
			target: Number(f.target),
			dueDate: f.dueDate,
		})),
		today.slice(0, 7),
		now,
		now,
	);
	return new Map(
		filled
			.filter((f) => refIds.includes(f.id))
			.map((f) => [
				f.id,
				{
					kind: "fund",
					name: f.name,
					balance: f.filled,
					currency: ws.baseCurrency,
					target: f.target,
				} satisfies LinkReading,
			]),
	);
}

async function readProjects(wsId: string, refIds: string[]) {
	if (refIds.length === 0) return new Map<string, LinkReading>();
	const rows = await db
		.select({
			id: seiryuProjects.id,
			name: seiryuProjects.name,
			isDone: seiryuColumns.isDone,
			cards: count(seiryuCards.id),
		})
		.from(seiryuProjects)
		.leftJoin(
			seiryuCards,
			and(eq(seiryuCards.projectId, seiryuProjects.id), isNull(seiryuCards.archivedAt)),
		)
		.leftJoin(seiryuColumns, eq(seiryuColumns.id, seiryuCards.columnId))
		.where(and(eq(seiryuProjects.workspaceId, wsId), inArray(seiryuProjects.id, refIds)))
		.groupBy(seiryuProjects.id, seiryuProjects.name, seiryuColumns.isDone);
	const out = new Map<string, LinkReading>();
	for (const r of rows) {
		const prev = out.get(r.id);
		const done = (prev?.kind === "project" ? prev.done : 0) + (r.isDone ? r.cards : 0);
		const total = (prev?.kind === "project" ? prev.total : 0) + r.cards;
		out.set(r.id, { kind: "project", name: r.name, done, total, projectId: r.id });
	}
	return out;
}

async function readHabits(wsId: string, refIds: string[], today: string) {
	if (refIds.length === 0) return new Map<string, LinkReading>();
	const since = addDays(today, -(HABIT_DAYS - 1));
	const [habits, logs] = await Promise.all([
		db
			.select()
			.from(keizokuHabits)
			.where(and(eq(keizokuHabits.workspaceId, wsId), inArray(keizokuHabits.id, refIds))),
		db
			.select({ id: keizokuHabitLogs.habitId, done: count() })
			.from(keizokuHabitLogs)
			.where(and(inArray(keizokuHabitLogs.habitId, refIds), gte(keizokuHabitLogs.date, since)))
			.groupBy(keizokuHabitLogs.habitId),
	]);
	const done = new Map(logs.map((l) => [l.id, l.done]));
	const days = lastDays(today, HABIT_DAYS);
	return new Map(
		habits.map((h) => [
			h.id,
			{
				kind: "habit",
				name: h.name,
				emoji: h.emoji,
				done: done.get(h.id) ?? 0,
				expected:
					h.frequencyType === "times_per_week"
						? (h.frequencyTarget ?? 0) * (HABIT_DAYS / 7)
						: days.filter((d) => isScheduled(h, d)).length,
			} satisfies LinkReading,
		]),
	);
}

async function readLists(wsId: string, refIds: string[]) {
	if (refIds.length === 0) return new Map<string, LinkReading>();
	const [lists, items] = await Promise.all([
		db
			.select({ id: hoshiiLists.id, name: hoshiiLists.name })
			.from(hoshiiLists)
			.where(and(eq(hoshiiLists.workspaceId, wsId), inArray(hoshiiLists.id, refIds))),
		db
			.select({ listId: hoshiiItems.listId, state: hoshiiItems.state, n: count() })
			.from(hoshiiItems)
			.where(and(eq(hoshiiItems.workspaceId, wsId), inArray(hoshiiItems.listId, refIds)))
			.groupBy(hoshiiItems.listId, hoshiiItems.state),
	]);
	const of = (listId: string, state: string) =>
		items.find((i) => i.listId === listId && i.state === state)?.n ?? 0;
	return new Map(
		lists.map((l) => [
			l.id,
			{
				kind: "list",
				name: l.name,
				cooling: of(l.id, "cooling"),
				planned: of(l.id, "plan"),
				bought: of(l.id, "bought"),
			} satisfies LinkReading,
		]),
	);
}

async function readShelves(wsId: string, refIds: string[]) {
	if (refIds.length === 0) return new Map<string, LinkReading>();
	const [shelves, books] = await Promise.all([
		db
			.select({ id: tsundokuShelves.id, name: tsundokuShelves.name })
			.from(tsundokuShelves)
			.where(and(eq(tsundokuShelves.workspaceId, wsId), inArray(tsundokuShelves.id, refIds))),
		db
			.select({ shelfId: tsundokuBookShelves.shelfId, status: tsundokuBooks.status })
			.from(tsundokuBookShelves)
			.innerJoin(tsundokuBooks, eq(tsundokuBooks.id, tsundokuBookShelves.bookId))
			.where(inArray(tsundokuBookShelves.shelfId, refIds)),
	]);
	return new Map(
		shelves.map((s) => {
			const on = books.filter((b) => b.shelfId === s.id);
			return [
				s.id,
				{
					kind: "shelf",
					name: s.name,
					finished: on.filter((b) => b.status === "read").length,
					total: on.length,
				} satisfies LinkReading,
			];
		}),
	);
}

async function readJobs(wsId: string, today: string): Promise<LinkReading> {
	const since = addDays(today, -JOB_DAYS);
	const [[sent], [answered], [active]] = await Promise.all([
		db
			.select({ n: count() })
			.from(kyuuApplications)
			.where(
				and(
					eq(kyuuApplications.workspaceId, wsId),
					notInArray(kyuuApplications.status, ["sourced", "drafted"]),
					gte(kyuuApplications.dateApplied, since),
				),
			),
		db
			.select({ n: count() })
			.from(kyuuEvents)
			.innerJoin(kyuuApplications, eq(kyuuApplications.id, kyuuEvents.applicationId))
			.where(
				and(
					eq(kyuuApplications.workspaceId, wsId),
					inArray(kyuuEvents.kind, ["screening", "interview", "offer", "rejected"]),
					gte(kyuuEvents.date, since),
				),
			),
		db
			.select({ n: count() })
			.from(kyuuApplications)
			.where(
				and(
					eq(kyuuApplications.workspaceId, wsId),
					isNull(kyuuApplications.archivedAt),
					inArray(kyuuApplications.status, ["hr_screening", "technical_interview", "offer"]),
				),
			),
	]);
	return { kind: "jobs", sent: sent?.n ?? 0, answered: answered?.n ?? 0, active: active?.n ?? 0 };
}

/** The workspace's open goals in order, each link read from its app. */
export async function getGoals(
	ws: { id: string; baseCurrency: string },
	today: string,
): Promise<GoalWithLinks[]> {
	const wsId = ws.id;
	const list = await db.query.goals.findMany({
		where: and(eq(goals.workspaceId, wsId), isNull(goals.archivedAt)),
		orderBy: [asc(goals.position)],
		with: { links: { orderBy: [asc(goalLinks.createdAt)] } },
	});
	const links = list.flatMap((g) => g.links);
	const [funds, projects, habits, lists, shelves, jobs] = await Promise.all([
		readFunds(ws, ids(links, "fund"), today),
		readProjects(wsId, ids(links, "project")),
		readHabits(wsId, ids(links, "habit"), today),
		readLists(wsId, ids(links, "list")),
		readShelves(wsId, ids(links, "shelf")),
		links.some((l) => l.kind === "jobs") ? readJobs(wsId, today) : null,
	]);
	const byKind = { fund: funds, project: projects, habit: habits, list: lists, shelf: shelves };
	return list.map((g) => ({
		...g,
		links: g.links.map((l) => {
			const found = l.kind === "jobs" ? jobs : l.refId ? byKind[l.kind].get(l.refId) : null;
			const reading: LinkReading = found ?? { kind: "missing", was: l.kind };
			return { ...l, reading };
		}),
	}));
}

/** Everything a goal could gather, for the link picker. */
export async function getLinkOptions(wsId: string): Promise<LinkOptions> {
	const [fund, project, habit, list, shelf] = await Promise.all([
		db
			.select({ id: kurojiFunds.id, name: kurojiFunds.name })
			.from(kurojiFunds)
			.where(eq(kurojiFunds.workspaceId, wsId))
			.orderBy(asc(kurojiFunds.dueDate)),
		db
			.select({ id: seiryuProjects.id, name: seiryuProjects.name })
			.from(seiryuProjects)
			.where(and(eq(seiryuProjects.workspaceId, wsId), isNull(seiryuProjects.archivedAt)))
			.orderBy(asc(seiryuProjects.position)),
		db
			.select({ id: keizokuHabits.id, name: keizokuHabits.name, emoji: keizokuHabits.emoji })
			.from(keizokuHabits)
			.where(and(eq(keizokuHabits.workspaceId, wsId), isNull(keizokuHabits.archivedAt)))
			.orderBy(asc(keizokuHabits.createdAt)),
		db
			.select({ id: hoshiiLists.id, name: hoshiiLists.name })
			.from(hoshiiLists)
			.where(eq(hoshiiLists.workspaceId, wsId))
			.orderBy(asc(hoshiiLists.position)),
		db
			.select({ id: tsundokuShelves.id, name: tsundokuShelves.name })
			.from(tsundokuShelves)
			.where(eq(tsundokuShelves.workspaceId, wsId))
			.orderBy(asc(tsundokuShelves.name)),
	]);
	return {
		fund,
		project,
		habit: habit.map((h) => ({ id: h.id, name: `${h.emoji} ${h.name}`.trim() })),
		list,
		shelf,
	};
}

/** Whether a container of this kind with this id is the workspace's own. */
export async function ownsContainer(wsId: string, kind: LinkKind, refId: string | null) {
	if (kind === "jobs") return refId == null;
	if (!refId) return false;
	const options = await getLinkOptions(wsId);
	return options[kind].some((o) => o.id === refId);
}
