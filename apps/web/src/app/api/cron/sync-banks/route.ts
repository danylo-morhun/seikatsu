import { syncConnection } from "@/features/kuroji/lib/bank-sync";
import { bankConnections, db, inArray } from "@seikatsu/db";
import { type NextRequest, NextResponse } from "next/server";

// Daily Vercel Cron (see vercel.json). Syncs every live connection. Guarded by
// CRON_SECRET: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
	}
	const auth = req.headers.get("authorization");
	if (auth !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Retry ERROR connections too; EXPIRED ones need user re-consent so skip them.
	const connections = await db
		.select()
		.from(bankConnections)
		.where(inArray(bankConnections.status, ["LINKED", "ERROR"]));

	let imported = 0;
	const failures: { id: string; error: string }[] = [];
	for (const conn of connections) {
		try {
			const result = await syncConnection(conn);
			imported += result.imported;
		} catch (e) {
			failures.push({ id: conn.id, error: e instanceof Error ? e.message : "unknown" });
		}
	}

	return NextResponse.json({
		synced: connections.length,
		imported,
		failures,
	});
}

// Long-running: allow up to 60s on Vercel.
export const maxDuration = 60;
