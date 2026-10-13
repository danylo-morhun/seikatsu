import { searchProviders } from "@/features/tsundoku/lib/search-providers";
import { getSessionUserId } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";

/** Book search for the add dialog: a GET the client can cancel as the query changes. */
export async function GET(req: NextRequest) {
	if (!(await getSessionUserId())) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
	if (q.length < 2) return NextResponse.json({ results: [] });

	const outcome = await searchProviders(q);
	if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: 502 });
	return NextResponse.json(
		{ results: outcome.results },
		{ headers: { "Cache-Control": "private, max-age=300" } },
	);
}
