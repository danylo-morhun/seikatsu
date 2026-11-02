import { getExchangeRate } from "@/features/kuroji/lib/exchange-rates";
import { generateDueForWorkspace } from "@/features/kuroji/lib/recurring-runner";
import {
	accounts,
	and,
	db,
	eq,
	hoshiiItems,
	isNull,
	lte,
	ne,
	recurringTransactions,
	workspaces,
} from "@seikatsu/db";
import { type NextRequest, NextResponse } from "next/server";

// Daily Vercel Cron (see vercel.json): materializes recurring transactions due today and
// stores today's exchange rates, so page renders never have to. Guarded by CRON_SECRET.
export async function GET(req: NextRequest) {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
	}
	if (req.headers.get("authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const today = new Date().toISOString().slice(0, 10);
	const due = await db
		.selectDistinct({ id: workspaces.id, baseCurrency: workspaces.baseCurrency })
		.from(recurringTransactions)
		.innerJoin(workspaces, eq(recurringTransactions.workspaceId, workspaces.id))
		.where(
			and(eq(recurringTransactions.isActive, true), lte(recurringTransactions.nextDate, today)),
		);

	let generated = 0;
	const failures: { id: string; error: string }[] = [];
	for (const ws of due) {
		try {
			generated += (await generateDueForWorkspace(ws)).generated;
		} catch (e) {
			failures.push({ id: ws.id, error: e instanceof Error ? e.message : "unknown" });
		}
	}

	const rates = await warmRates(today);
	return NextResponse.json({ workspaces: due.length, generated, failures, rates });
}

/** Stores today's rate for each foreign currency in use (open accounts, wants). */
async function warmRates(today: string) {
	const [inAccounts, inWants] = await Promise.all([
		db
			.selectDistinct({ from: accounts.currency, to: workspaces.baseCurrency })
			.from(accounts)
			.innerJoin(workspaces, eq(accounts.workspaceId, workspaces.id))
			.where(and(isNull(accounts.archivedAt), ne(accounts.currency, workspaces.baseCurrency))),
		db
			.selectDistinct({ from: hoshiiItems.currency, to: workspaces.baseCurrency })
			.from(hoshiiItems)
			.innerJoin(workspaces, eq(hoshiiItems.workspaceId, workspaces.id))
			.where(ne(hoshiiItems.currency, workspaces.baseCurrency)),
	]);
	const pairs = new Map([...inAccounts, ...inWants].map((p) => [`${p.from}>${p.to}`, p]));
	const results = await Promise.allSettled(
		[...pairs.values()].map((p) => getExchangeRate(p.from, p.to, today)),
	);
	return { pairs: pairs.size, failed: results.filter((r) => r.status === "rejected").length };
}
