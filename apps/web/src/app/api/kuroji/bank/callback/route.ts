import { finalizeConnection } from "@/features/kuroji/actions/bank";
import { type NextRequest, NextResponse } from "next/server";

// Enable Banking redirects the end user here after bank authentication with
// `code` (authorization code) + `state` (the per-connection token we set).
export async function GET(req: NextRequest) {
	const code = req.nextUrl.searchParams.get("code");
	const state = req.nextUrl.searchParams.get("state");
	const error = req.nextUrl.searchParams.get("error");
	const settings = new URL("/settings/kuroji", req.nextUrl.origin);

	if (error || !code || !state) {
		settings.searchParams.set("bank", "error");
		return NextResponse.redirect(settings);
	}

	const result = await finalizeConnection(state, code);
	settings.searchParams.set("bank", "error" in result ? "error" : "connected");
	return NextResponse.redirect(settings);
}
