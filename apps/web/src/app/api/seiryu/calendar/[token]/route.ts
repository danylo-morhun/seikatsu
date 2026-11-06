import { type NextRequest, NextResponse } from "next/server";
import { originOf } from "@/features/mcp/lib/oauth";
import { readFeed } from "@/features/seiryu/lib/calendar-feed";
import { buildCalendar } from "@/features/seiryu/lib/ics";

// The calendar feed a phone's calendar subscribes to (Settings → Seiryu → Calendar). No
// session: the secret in the link is the key, so an unknown one just isn't there.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	const feed = await readFeed(token.replace(/\.ics$/, ""));
	if (!feed) return new NextResponse("Not found", { status: 404 });

	const body = buildCalendar(feed.cards, {
		timeZone: feed.timeZone,
		origin: originOf(req.headers),
		now: new Date(),
	});
	return new NextResponse(body, {
		headers: {
			"content-type": "text/calendar; charset=utf-8",
			"cache-control": "private, max-age=300",
		},
	});
}
