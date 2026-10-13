import { authConfig } from "@/auth.config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_EXACT = ["/", "/privacy", "/terms"];
const PUBLIC_PREFIXES = ["/auth/"];

export default auth((req) => {
	const { pathname } = req.nextUrl;
	// Remote images (book covers) may come from any host; only users may use the optimizer.
	if (pathname === "/_next/image") {
		const isRemote = /^https?:/.test(req.nextUrl.searchParams.get("url") ?? "");
		if (isRemote && !req.auth) return new NextResponse(null, { status: 401 });
		return;
	}
	const isPublic =
		PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
	if (!req.auth && !isPublic) {
		return NextResponse.redirect(new URL("/", req.url));
	}
});

export const config = {
	// Skip API routes, Next internals and any static file (path with an extension), but
	// guard the image optimizer.
	matcher: ["/((?!api|_next|.*\\..*).*)", "/_next/image"],
};
