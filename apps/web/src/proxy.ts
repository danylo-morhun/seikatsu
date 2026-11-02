import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_EXACT = ["/", "/privacy", "/terms", "/offline"];
const PUBLIC_PREFIXES = ["/auth/"];

export default auth((req) => {
	const { pathname } = req.nextUrl;
	const isPublic =
		PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
	if (!req.auth && !isPublic) {
		return NextResponse.redirect(new URL("/", req.url));
	}
});

export const config = {
	// Skip API routes, Next internals and any static file (path with an extension).
	matcher: ["/((?!api|_next|.*\\..*).*)"],
};
