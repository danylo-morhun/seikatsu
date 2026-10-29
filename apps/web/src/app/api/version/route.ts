import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The live deploy's build, so a page served from the worker's cache can tell it's stale
// (features/pwa/components/ServiceWorker.tsx). Public: it says nothing about the user.
export function GET() {
	return NextResponse.json(
		{ build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
