import { generateDueForWorkspace } from "@/features/kuroji/lib/recurring-runner";
import { and, db, eq, lte, recurringTransactions, workspaces } from "@seikatsu/db";
import { type NextRequest, NextResponse } from "next/server";

// Daily Vercel Cron (see vercel.json): materializes recurring transactions due today, so
// page renders never have to. Guarded by CRON_SECRET like sync-banks.
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

	return NextResponse.json({ workspaces: due.length, generated, failures });
}
