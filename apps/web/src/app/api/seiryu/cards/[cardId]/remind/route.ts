import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { finishOnServer, snoozeCard } from "@/features/seiryu/actions/cards";
import { SNOOZE_MINUTES } from "@/features/seiryu/lib/reminder";

const bodySchema = z.object({ action: z.enum(["done", "snooze"]) });

// A reminder's buttons, pressed in the notification (the service worker posts here with the
// session cookie): Done finishes the card, "In 1 hour" reminds again.
export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
	if (!(await auth())?.user?.id) return NextResponse.json({ error: "Sign in" }, { status: 401 });
	const parsed = bodySchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

	const { cardId } = await params;
	const result =
		parsed.data.action === "done"
			? await finishOnServer({ cardId })
			: await snoozeCard({ cardId, minutes: SNOOZE_MINUTES });
	return "error" in result
		? NextResponse.json(result, { status: 400 })
		: NextResponse.json({ ok: true });
}
