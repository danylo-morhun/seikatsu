import { replay } from "@/features/pwa/lib/registry";
import { getCurrentWorkspace } from "@/lib/session";
import { and, db, eq, outboxReceipts } from "@seikatsu/db";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
	opId: z.uuid(),
	name: z.string().max(100),
	args: z.unknown(),
});

// Replays one operation queued while offline (features/pwa/lib/outbox.ts). Same session auth
// as server actions; the receipt makes a retried replay return the first result, not run again.
// 200 with { result } for domain outcomes (success or a validation error), 409 while the first
// attempt of the same op is still running, 401 when signed out.
export async function POST(req: NextRequest) {
	const ws = await getCurrentWorkspace();
	if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = bodySchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
	const { opId, name, args } = parsed.data;

	const claimed = await db
		.insert(outboxReceipts)
		.values({ opId, workspaceId: ws.id, name })
		.onConflictDoNothing()
		.returning({ opId: outboxReceipts.opId });

	if (claimed.length === 0) {
		const [receipt] = await db
			.select({ result: outboxReceipts.result })
			.from(outboxReceipts)
			.where(and(eq(outboxReceipts.opId, opId), eq(outboxReceipts.workspaceId, ws.id)));
		if (!receipt) return NextResponse.json({ error: "Conflict" }, { status: 409 });
		if (receipt.result == null) return NextResponse.json({ error: "In progress" }, { status: 409 });
		return NextResponse.json({ result: receipt.result });
	}

	try {
		const result = await replay(name, args);
		await db.update(outboxReceipts).set({ result }).where(eq(outboxReceipts.opId, opId));
		return NextResponse.json({ result });
	} catch {
		// Let the next attempt run it again.
		await db.delete(outboxReceipts).where(eq(outboxReceipts.opId, opId));
		return NextResponse.json({ error: "Failed" }, { status: 500 });
	}
}
