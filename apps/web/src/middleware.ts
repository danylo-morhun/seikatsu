import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/auth/", "/privacy", "/terms"];

export default auth((req) => {
	const { pathname } = req.nextUrl;
	const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
	if (!req.auth && !isPublic) {
		return NextResponse.redirect(new URL("/", req.url));
	}
});

export const config = {
	matcher: ["/((?!api|_next|favicon.ico).*)"],
};
