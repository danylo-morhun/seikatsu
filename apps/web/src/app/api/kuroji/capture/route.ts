import { parseWalletAmount } from "@/features/kuroji/lib/apple-pay";
import { recordCapture, workspaceOfCaptureKey } from "@/features/kuroji/lib/capture-intake";
import { toCurrency } from "@/features/kuroji/lib/constants";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { sendToWorkspace } from "@/features/pwa/lib/push";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";

// The iPhone Shortcut (Settings → Kuroji → Banks & import → Apple Pay) posts every Wallet
// payment here with `Authorization: Bearer <key>`. It waits in Kuroji's inbox, and a push
// opens the transaction dialog with it filled in.

const bodySchema = z.object({
	// Wallet text in the phone's locale ("12,50 zł"), or a plain number.
	amount: z.union([z.string().max(100), z.number()]),
	currency: z.string().max(10).optional(),
	merchant: z.string().max(200).optional(),
	card: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
	const key = req.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
	const owner = key ? await workspaceOfCaptureKey(key) : null;
	if (!owner) return NextResponse.json({ error: "Unknown key" }, { status: 401 });

	const parsed = bodySchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	const { amount: rawAmount, currency, merchant, card } = parsed.data;

	const fallback = toCurrency(currency?.trim().toUpperCase() || owner.baseCurrency);
	const payment = parseWalletAmount(String(rawAmount), fallback);
	if (!payment) return NextResponse.json({ error: "Unreadable amount" }, { status: 400 });

	const what = merchant?.trim() || "Apple Pay";
	const id = await recordCapture(owner.id, {
		...payment,
		merchant: what,
		card: card?.trim() || null,
	});

	after(async () => {
		revalidatePath("/kuroji", "layout");
		await sendToWorkspace(owner.id, {
			title: `${formatCurrency(payment.amount, payment.currency)} · ${what}`,
			body: "Tap to add it to Kuroji",
			url: `/kuroji?capture=${id}`,
			tag: `capture:${id}`,
		});
	});

	return NextResponse.json({ id }, { status: 201 });
}
