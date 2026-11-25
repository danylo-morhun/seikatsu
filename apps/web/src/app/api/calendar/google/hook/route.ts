import { after, type NextRequest, NextResponse } from "next/server";
import { workspaceOfPing } from "@/features/calendar/google/channels";
import { syncGoogle } from "@/features/calendar/google/sync";

/** Google says a watched calendar changed: sync that workspace, after answering. */
export async function POST(req: NextRequest) {
	const channelId = req.headers.get("x-goog-channel-id");
	const token = req.headers.get("x-goog-channel-token");
	const state = req.headers.get("x-goog-resource-state");
	if (!channelId || !token) return new NextResponse(null, { status: 400 });
	const workspaceId = await workspaceOfPing(channelId, token);
	// Unknown or stale channel: Google stops sending once it hears 404.
	if (!workspaceId) return new NextResponse(null, { status: 404 });
	if (state !== "sync") after(() => syncGoogle(workspaceId));
	return new NextResponse(null, { status: 200 });
}
