import { fillCountries } from "@/features/kyuu/actions/country-fill";
import { syncMail, workspaceOfMailKey } from "@/features/kyuu/actions/mail-sync";
import { db, eq, kyuuMailKeys } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";

// The Gmail script (Settings → Kyuu → Mail) posts the last few days of mail here every
// 30 minutes with `Authorization: Bearer <key>`. Mail already read is skipped; the rest is
// read after the response, so the script never waits on Gemini.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bodySchema = z.object({
	account: z.string().email().max(320).nullable().optional(),
	messages: z
		.array(
			z.object({
				id: z.string().regex(/^[\w-]{1,64}$/),
				threadId: z.string().regex(/^[\w-]{1,64}$/),
				from: z.string().max(1_000),
				subject: z.string().max(2_000),
				date: z.string().datetime({ offset: true }),
				day,
				body: z.string().max(20_000),
			}),
		)
		.max(200),
});

export async function POST(req: NextRequest) {
	const key = req.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
	const owner = key ? await workspaceOfMailKey(key) : null;
	if (!owner) return NextResponse.json({ error: "Unknown key" }, { status: 401 });

	const parsed = bodySchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

	const now = new Date();
	await db
		.update(kyuuMailKeys)
		.set({ lastSyncAt: now })
		.where(eq(kyuuMailKeys.workspaceId, owner.workspaceId));

	after(async () => {
		const result = await syncMail(
			owner.workspaceId,
			parsed.data.messages,
			parsed.data.account ?? null,
		);
		// Rows the pipeline added since the last run get their country too (each is tried once).
		const since = owner.lastSyncAt ?? new Date(now.getTime() - 86_400_000);
		const countries = await fillCountries(owner.workspaceId, { since, limit: 30 }).catch(
			() => null,
		);
		if (result.applied + result.review > 0 || countries?.filled) {
			revalidatePath("/kyuu", "layout");
		}
		console.log("kyuu mail sync", { ...result, countries });
	});

	return NextResponse.json({ received: parsed.data.messages.length }, { status: 202 });
}

// Reading a run's mail with Gemini takes a while.
export const maxDuration = 300;
