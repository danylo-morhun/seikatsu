"use server";

import { auth } from "@/auth";
import {
	dayBefore,
	ensureUncategorized,
	insertImported,
	matchRule,
	postOpeningBalance,
} from "@/features/kuroji/lib/import-core";
import {
	matchPrivat24Category,
	parsePrivat24Xlsx,
	privat24Description,
	privat24ExternalId,
	privat24IsInflow,
} from "@/features/kuroji/lib/privat24";
import {
	accounts,
	and,
	asc,
	bankRules,
	count,
	db,
	eq,
	ilike,
	isNull,
	transactions,
	workspaces,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = { error: string } | ({ success: true } & T);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — statements are tiny.

// Import a Privat24 personal-card statement (.xlsx) into an existing Kuroji
// asset/liability account. Posts deduped double-entries; on the first import
// into the account it seeds an opening balance from the file's running-balance
// column so the absolute balance reconciles with the card.
export async function importPrivat24Statement(
	formData: FormData,
): Promise<Result<{ imported: number; skipped: number; seededOpening: boolean }>> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const workspaceId = formData.get("workspaceId");
	const accountId = formData.get("accountId");
	const file = formData.get("file");
	if (typeof workspaceId !== "string" || typeof accountId !== "string") {
		return { error: "Missing workspace or account" };
	}
	if (!(file instanceof File)) return { error: "No file uploaded" };
	if (file.size === 0) return { error: "File is empty" };
	if (file.size > MAX_BYTES) return { error: "File too large (max 5 MB)" };

	// Workspace ownership.
	const [ws] = await db
		.select({ userId: workspaces.userId, baseCurrency: workspaces.baseCurrency })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);
	if (!ws) return { error: "Workspace not found" };
	if (ws.userId !== session.user.id) return { error: "Forbidden" };

	// Target account must belong to the workspace and be asset/liability.
	const [acct] = await db
		.select({ id: accounts.id, type: accounts.type })
		.from(accounts)
		.where(and(eq(accounts.id, accountId), eq(accounts.workspaceId, workspaceId)))
		.limit(1);
	if (!acct) return { error: "Account not found" };
	if (acct.type !== "ASSET" && acct.type !== "LIABILITY") {
		return { error: "Statements can only import into an asset or liability account" };
	}

	// Parse the file.
	let statement: ReturnType<typeof parsePrivat24Xlsx>;
	try {
		const buf = new Uint8Array(await file.arrayBuffer());
		statement = parsePrivat24Xlsx(buf);
	} catch (e) {
		return { error: e instanceof Error ? e.message : "Failed to read statement" };
	}
	if (statement.rows.length === 0) {
		return { error: "No transactions found in the file. Is this a Privat24 statement export?" };
	}

	const baseCurrency = ws.baseCurrency;
	const rules = await db
		.select({ matchText: bankRules.matchText, accountId: bankRules.accountId })
		.from(bankRules)
		.where(eq(bankRules.workspaceId, workspaceId))
		.orderBy(asc(bankRules.priority), asc(bankRules.createdAt));
	const uncategorized = await ensureUncategorized(workspaceId, baseCurrency);

	// Existing category accounts, split by side, for Privat24 category matching.
	const categoryAccounts = await db
		.select({ id: accounts.id, name: accounts.name, type: accounts.type })
		.from(accounts)
		.where(and(eq(accounts.workspaceId, workspaceId), isNull(accounts.archivedAt)));
	const incomeAccounts = categoryAccounts.filter((a) => a.type === "INCOME");
	const expenseAccounts = categoryAccounts.filter((a) => a.type === "EXPENSE");

	// First import into this account? Used to decide whether to seed an opening
	// balance — only the first statement establishes the starting point.
	const idPrefix = `p24:${accountId}:`;
	const [{ value: priorCount }] = await db
		.select({ value: count() })
		.from(transactions)
		.where(
			and(
				eq(transactions.workspaceId, workspaceId),
				ilike(transactions.externalId, `${idPrefix}%`),
			),
		);
	const isFirstImport = priorCount === 0;

	let imported = 0;
	let skipped = 0;
	let net = 0; // signed net flow across this file, in card currency
	let earliest: string | null = null;
	const cardCurrency = statement.cardCurrency ?? baseCurrency;

	for (const row of statement.rows) {
		if (!Number.isFinite(row.amount) || row.amount === 0) {
			skipped++;
			continue;
		}
		net += row.amount;
		if (!earliest || row.date < earliest) earliest = row.date;

		const isInflow = privat24IsInflow(row);
		const description = privat24Description(row);
		// Precedence: explicit keyword rule → Privat24 category → uncategorized.
		const sideAccounts = isInflow ? incomeAccounts : expenseAccounts;
		const counterpartId =
			matchRule(description, rules) ??
			matchPrivat24Category(row.category, sideAccounts) ??
			(isInflow ? uncategorized.incomeId : uncategorized.expenseId);
		const created = await insertImported({
			workspaceId,
			externalId: privat24ExternalId(row, accountId),
			date: row.date,
			description,
			bankAccountId: accountId,
			counterpartId,
			isInflow,
			amount: Math.abs(row.amount),
			currency: cardCurrency,
			baseCurrency,
		});
		if (created) imported++;
		else skipped++;
	}

	// Seed opening balance once: opening = closingBalance − netFlow, posted the
	// day before the earliest row, so the account reconciles with the card.
	let seededOpening = false;
	if (isFirstImport && statement.closingBalance !== null && earliest) {
		await postOpeningBalance({
			workspaceId,
			kurojiAccountId: accountId,
			externalId: `opening:privat24:${accountId}`,
			opening: statement.closingBalance - net,
			openingDate: dayBefore(earliest),
			currency: cardCurrency,
			baseCurrency,
		});
		seededOpening = true;
	}

	revalidatePath("/kuroji");
	revalidatePath("/settings/kuroji");
	return { success: true, imported, skipped, seededOpening };
}
