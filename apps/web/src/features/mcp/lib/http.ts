// Shared bits of the OAuth + MCP routes. They're called by servers and CLIs, and by browser
// tools like MCP Inspector, so they answer CORS — safe, as nothing here reads cookies.

import { NextResponse } from "next/server";

export const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers":
		"Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
	"Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export const preflight = () => new NextResponse(null, { status: 204, headers: CORS });

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return NextResponse.json(body, {
		status,
		headers: { ...CORS, "Cache-Control": "no-store", ...headers },
	});
}

/** Token endpoint bodies are form-encoded (RFC 6749); accept JSON too. */
export async function readParams(req: Request): Promise<Record<string, string>> {
	const type = req.headers.get("content-type") ?? "";
	if (type.includes("application/json")) {
		const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
		return Object.fromEntries(
			Object.entries(body ?? {}).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
		);
	}
	const form = await req.formData().catch(() => null);
	if (!form) return {};
	return Object.fromEntries(
		[...form.entries()].flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
	);
}
