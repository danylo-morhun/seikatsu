import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";

// How a full page load went on a real device (features/pwa/components/LaunchTiming.tsx),
// one log line per load: read with `vercel logs` to see where a slow launch spends its time.

const ms = z.number().min(0).max(600_000).optional();
const bodySchema = z.object({
	path: z.string().max(200),
	type: z.string().max(20).optional(),
	standalone: z.boolean(),
	controlled: z.boolean(),
	transferSize: z.number().min(0).optional(),
	workerStart: ms,
	fetchStart: ms,
	responseStart: ms,
	responseEnd: ms,
	domInteractive: ms,
	domContentLoaded: ms,
	loadEnd: ms,
	hydrated: ms,
});

export async function POST(req: NextRequest) {
	// Signed-in users only: nobody else's timings are worth a log line.
	if (!(await auth())) return new NextResponse(null, { status: 204 });
	const parsed = bodySchema.safeParse(await req.json().catch(() => null));
	if (parsed.success) console.info(`[vitals] ${JSON.stringify(parsed.data)}`);
	return new NextResponse(null, { status: 204 });
}
