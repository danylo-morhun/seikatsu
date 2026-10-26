import { NextResponse } from "next/server";

/**
 * The PWA's share target: a shop app shares its link (in `url`, or inside `text` on
 * Android), and the Add dialog opens with it.
 */
export function GET(request: Request) {
	const params = new URL(request.url).searchParams;
	const found = [params.get("url"), params.get("text"), params.get("title")]
		.map((v) => v?.match(/https?:\/\/\S+/)?.[0])
		.find(Boolean);
	const target = new URL("/hoshii", request.url);
	if (found) target.searchParams.set("add", found);
	return NextResponse.redirect(target, 303);
}
