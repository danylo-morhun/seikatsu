// Server-only read: what the capture line may point at — the user's own wallets, categories,
// car, projects, habits and books. Not a "use server" module.

import {
	accounts,
	and,
	asc,
	count,
	db,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	seiryuColumns,
	transactionEntries,
	transactions,
} from "@seikatsu/db";
import { type CaptureContext, type Named, pickMerchants } from "@/features/capture/lib/plan";
import { loadCar, loadReading } from "@/features/home/lib/today";
import { getChromeData } from "@/features/hoshii/actions/data";
import { getHabits } from "@/features/keizoku/actions/habits";
import { getAccounts } from "@/features/kuroji/actions/data";
import { getProjects } from "@/features/seiryu/actions/projects";
import type { Workspace } from "@/lib/session";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];

const SYSTEM = new Set(["Opening Balance"]);

/** Categories by their full path ("Transport / Fuel"), so the model can tell them apart. */
function named(all: Account[], type: Account["type"]): Named[] {
	const byId = new Map(all.map((a) => [a.id, a]));
	const path = (a: Account): string => {
		const parent = a.parentId ? byId.get(a.parentId) : undefined;
		return parent ? `${path(parent)} / ${a.name}` : a.name;
	};
	return all
		.filter((a) => a.type === type && !SYSTEM.has(a.name))
		.map((a) => ({ id: a.id, name: path(a) }));
}

/** Each project's first column that isn't the finish one: where a new card lands. */
async function inboxColumns(projectIds: string[]): Promise<Map<string, string>> {
	if (projectIds.length === 0) return new Map();
	const columns = await db
		.select({ id: seiryuColumns.id, projectId: seiryuColumns.projectId })
		.from(seiryuColumns)
		.where(and(inArray(seiryuColumns.projectId, projectIds), eq(seiryuColumns.isDone, false)))
		.orderBy(asc(seiryuColumns.position));
	const first = new Map<string, string>();
	for (const c of columns) if (!first.has(c.projectId)) first.set(c.projectId, c.id);
	return first;
}

/** A year of expenses by description and category: where they spend, and how they file it. */
async function merchantUses(workspaceId: string, today: string) {
	const since = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
	const uses = count();
	return db
		.select({
			description: transactions.description,
			categoryId: transactionEntries.accountId,
			uses,
		})
		.from(transactionEntries)
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.innerJoin(accounts, eq(accounts.id, transactionEntries.accountId))
		.where(
			and(
				eq(transactions.workspaceId, workspaceId),
				eq(accounts.type, "EXPENSE"),
				isNotNull(transactions.description),
				gte(transactions.date, since),
			),
		)
		.groupBy(transactions.description, transactionEntries.accountId)
		.orderBy(desc(uses))
		.limit(400);
}

export async function getCaptureContext(ws: Workspace, today: string): Promise<CaptureContext> {
	const [all, car, projects, habits, books, hoshii, spent] = await Promise.all([
		getAccounts(ws.id),
		loadCar(today),
		getProjects(),
		getHabits(),
		loadReading(),
		getChromeData(ws),
		merchantUses(ws.id, today),
	]);
	const live = projects.filter((p) => !p.archivedAt);
	const expenseCategories = named(all, "EXPENSE");
	const expense = new Set(expenseCategories.map((c) => c.id));
	const columns = await inboxColumns(live.map((p) => p.id));

	return {
		today,
		baseCurrency: ws.baseCurrency,
		wallets: all
			.filter((a) => (a.type === "ASSET" || a.type === "LIABILITY") && !SYSTEM.has(a.name))
			.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
		expenseCategories,
		incomeCategories: named(all, "INCOME"),
		// Only categories still offered: an archived one would be dropped by toPlan anyway.
		merchants: pickMerchants(
			spent.flatMap((r) =>
				r.description && expense.has(r.categoryId)
					? [{ description: r.description, categoryId: r.categoryId, uses: r.uses }]
					: [],
			),
		),
		vehicle: car ? { id: car.vehicleId, name: car.name, currentKm: car.currentKm } : null,
		projects: live.flatMap((p) => {
			const columnId = columns.get(p.id);
			return columnId ? [{ id: p.id, name: p.name, columnId }] : [];
		}),
		lists: hoshii.lists,
		habits: habits.map((h) => ({ id: h.id, name: h.name, emoji: h.emoji })),
		books: (books ?? []).map((b) => ({
			id: b.id,
			title: b.title,
			currentPage: b.currentPage,
			pageCount: b.pageCount,
		})),
	};
}
