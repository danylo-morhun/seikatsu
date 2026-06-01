"use server";

import { auth } from "@/auth";
import { getExchangeRate } from "@/features/kuroji/lib/exchange-rates";
import {
	accounts,
	and,
	db,
	eq,
	gte,
	isNull,
	lte,
	or,
	recurringTransactions,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurringTransaction = {
	id: string;
	fromAccountId: string;
	fromAccountName: string;
	toAccountId: string;
	toAccountName: string;
	amount: string;
	currency: string;
	description: string | null;
	frequency: Frequency;
	nextDate: string;
	endDate: string | null;
	isActive: boolean;
};

function advanceDate(dateStr: string, frequency: Frequency): string {
	const [y, m, d] = dateStr.split("-").map(Number);

	if (frequency === "daily" || frequency === "weekly") {
		const dt = new Date(y, m - 1, d);
		dt.setDate(dt.getDate() + (frequency === "daily" ? 1 : 7));
		return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
	}

	if (frequency === "monthly") {
		// next month in 0-indexed; wrap Dec→Jan
		const nm = m % 12; // 0-indexed next month (Jan=0)
		const ny = m === 12 ? y + 1 : y;
		const cap = new Date(ny, nm + 1, 0).getDate(); // last day of next month
		return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, cap)).padStart(2, "0")}`;
	}

	// yearly — clamp Feb 29 → Feb 28 in non-leap years
	const cap = new Date(y + 1, m, 0).getDate(); // last day of same month next year
	return `${y + 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, cap)).padStart(2, "0")}`;
}

export async function getRecurringTransactions(
	workspaceId: string,
): Promise<RecurringTransaction[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) throw new Error("Forbidden");

	const rows = await db.query.recurringTransactions.findMany({
		where: eq(recurringTransactions.workspaceId, workspaceId),
		with: {
			fromAccount: true,
			toAccount: true,
		},
		orderBy: (rt, { desc }) => [desc(rt.createdAt)],
	});

	return rows.map((r) => ({
		id: r.id,
		fromAccountId: r.fromAccountId,
		fromAccountName: r.fromAccount?.name ?? "—",
		toAccountId: r.toAccountId,
		toAccountName: r.toAccount?.name ?? "—",
		amount: r.amount,
		currency: r.currency,
		description: r.description,
		frequency: r.frequency as Frequency,
		nextDate: r.nextDate,
		endDate: r.endDate,
		isActive: r.isActive,
	}));
}

export async function createRecurringTransaction(data: {
	workspaceId: string;
	fromAccountId: string;
	toAccountId: string;
	amount: number;
	currency: string;
	description?: string;
	frequency: Frequency;
	startDate: string;
	endDate?: string;
}): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [wsRows, fromRows, toRows] = await Promise.all([
		db.select().from(workspaces).where(eq(workspaces.id, data.workspaceId)).limit(1),
		db
			.select({ id: accounts.id })
			.from(accounts)
			.where(and(eq(accounts.id, data.fromAccountId), eq(accounts.workspaceId, data.workspaceId)))
			.limit(1),
		db
			.select({ id: accounts.id })
			.from(accounts)
			.where(and(eq(accounts.id, data.toAccountId), eq(accounts.workspaceId, data.workspaceId)))
			.limit(1),
	]);

	const ws = wsRows[0];
	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };
	if (!fromRows[0] || !toRows[0]) return { error: "Account not found" };

	await db.insert(recurringTransactions).values({
		workspaceId: data.workspaceId,
		fromAccountId: data.fromAccountId,
		toAccountId: data.toAccountId,
		amount: String(data.amount),
		currency: data.currency,
		description: data.description ?? null,
		frequency: data.frequency,
		nextDate: data.startDate,
		endDate: data.endDate ?? null,
		isActive: true,
	});

	revalidatePath("/kuroji");
	return { success: true };
}

export async function toggleRecurring(id: string): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [rt] = await db
		.select()
		.from(recurringTransactions)
		.where(eq(recurringTransactions.id, id))
		.limit(1);
	if (!rt) return { error: "Not found" };

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, rt.workspaceId))
		.limit(1);
	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };

	await db
		.update(recurringTransactions)
		.set({ isActive: !rt.isActive, updatedAt: new Date() })
		.where(eq(recurringTransactions.id, id));
	revalidatePath("/kuroji");
	return { success: true };
}

export async function deleteRecurringTransaction(
	id: string,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [rt] = await db
		.select({ workspaceId: recurringTransactions.workspaceId })
		.from(recurringTransactions)
		.where(eq(recurringTransactions.id, id))
		.limit(1);
	if (!rt) return { error: "Not found" };

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, rt.workspaceId))
		.limit(1);
	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };

	await db.delete(recurringTransactions).where(eq(recurringTransactions.id, id));
	revalidatePath("/kuroji");
	return { success: true };
}

export async function generateDueRecurring(workspaceId: string): Promise<{ generated: number }> {
	const session = await auth();
	if (!session?.user?.id) return { generated: 0 };

	const [ws] = await db
		.select({ userId: workspaces.userId, baseCurrency: workspaces.baseCurrency })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) return { generated: 0 };

	const today = new Date().toISOString().slice(0, 10);

	const due = await db
		.select()
		.from(recurringTransactions)
		.where(
			and(
				eq(recurringTransactions.workspaceId, workspaceId),
				eq(recurringTransactions.isActive, true),
				lte(recurringTransactions.nextDate, today),
				or(
					isNull(recurringTransactions.endDate),
					gte(recurringTransactions.endDate, recurringTransactions.nextDate),
				),
			),
		);

	let generated = 0;
	const MAX_ITERATIONS = 365;

	for (const rt of due) {
		// Pre-fetch all exchange rates needed for this RT outside the DB transaction
		// to avoid holding a connection open during network I/O.
		const rateCache = new Map<string, number>();
		if (rt.currency !== ws.baseCurrency) {
			let d = rt.nextDate;
			let iters = 0;
			while (d <= today && iters < MAX_ITERATIONS) {
				if (rt.endDate && d > rt.endDate) break;
				try {
					rateCache.set(d, await getExchangeRate(rt.currency, ws.baseCurrency, d));
				} catch {
					break;
				}
				d = advanceDate(d, rt.frequency as Frequency);
				iters++;
			}
		}

		let rtGenerated = 0;

		await db.transaction(async (tx) => {
			// SELECT FOR UPDATE serializes concurrent calls: the second concurrent
			// request will wait here, then see nextDate already advanced and bail.
			const [locked] = await tx
				.select({ id: recurringTransactions.id })
				.from(recurringTransactions)
				.where(
					and(eq(recurringTransactions.id, rt.id), eq(recurringTransactions.nextDate, rt.nextDate)),
				)
				.for("update")
				.limit(1);

			if (!locked) return;

			let currentDate = rt.nextDate;
			let iterations = 0;

			while (currentDate <= today && iterations < MAX_ITERATIONS) {
				if (rt.endDate && currentDate > rt.endDate) break;

				const amount = Number(rt.amount);
				let baseAmount: number;
				if (rt.currency === ws.baseCurrency) {
					baseAmount = amount;
				} else {
					const rate = rateCache.get(currentDate);
					if (rate === undefined) break;
					baseAmount = amount * rate;
				}

				const [txn] = await tx
					.insert(transactions)
					.values({ workspaceId, date: currentDate, description: rt.description })
					.returning();

				await tx.insert(transactionEntries).values([
					{
						transactionId: txn.id,
						accountId: rt.fromAccountId,
						amount: String(-amount),
						currency: rt.currency,
						baseAmount: (-baseAmount).toFixed(4),
					},
					{
						transactionId: txn.id,
						accountId: rt.toAccountId,
						amount: String(amount),
						currency: rt.currency,
						baseAmount: baseAmount.toFixed(4),
					},
				]);

				rtGenerated++;
				currentDate = advanceDate(currentDate, rt.frequency as Frequency);
				iterations++;
			}

			// Only advance nextDate when we actually processed at least one period.
			if (rtGenerated > 0) {
				await tx
					.update(recurringTransactions)
					.set({ nextDate: currentDate, updatedAt: new Date() })
					.where(eq(recurringTransactions.id, rt.id));
			}
		});

		generated += rtGenerated;
	}

	if (generated > 0) revalidatePath("/kuroji");
	return { generated };
}
