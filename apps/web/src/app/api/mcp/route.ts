import { createMcpHandler } from "@modelcontextprotocol/server";
import { db, eq, mcpGrants } from "@seikatsu/db";
import { after, type NextRequest } from "next/server";
import { CORS, json, preflight } from "@/features/mcp/lib/http";
import { originOf, verifyAccessToken } from "@/features/mcp/lib/oauth";
import { allowCall } from "@/features/mcp/lib/rate";
import { buildServer } from "@/features/mcp/lib/server";

// seikatsu's MCP endpoint (docs/mcp-prd.md): stateless — every POST builds the caller's
// server, answers in JSON and is done. Serves the 2026-07-28 revision (claude.ai asks for it
// first) and the 2025 ones. Auth is an OAuth bearer token
// (features/mcp/lib/oauth.ts) or a personal token from Settings.

export const maxDuration = 30;

function unauthorized(req: NextRequest, invalid: boolean) {
	const origin = originOf(req.headers);
	const meta = `${origin}/.well-known/oauth-protected-resource/api/mcp`;
	return json({ error: invalid ? "invalid_token" : "unauthorized" }, 401, {
		"WWW-Authenticate": invalid
			? `Bearer error="invalid_token", resource_metadata="${meta}"`
			: `Bearer resource_metadata="${meta}"`,
	});
}

export async function POST(req: NextRequest) {
	const token = req.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
	if (!token) return unauthorized(req, false);
	const caller = await verifyAccessToken(token);
	if (!caller) return unauthorized(req, true);
	if (!(await allowCall(caller.grantId))) {
		return json({ error: "Too many requests" }, 429, { "Retry-After": "60" });
	}

	// "Last used" for Settings, at most every few minutes.
	if (!caller.lastUsedAt || Date.now() - caller.lastUsedAt.getTime() > 5 * 60_000) {
		after(() =>
			db.update(mcpGrants).set({ lastUsedAt: new Date() }).where(eq(mcpGrants.id, caller.grantId)),
		);
	}

	const handler = createMcpHandler(() => buildServer(caller), {
		legacy: "stateless",
		responseMode: "json",
		// Rejected requests (a version the client tries first, bad JSON) are routine: log only.
		// Tool failures reach Sentry from lib/server.ts.
		onerror: (error) => console.warn("[mcp]", error.message),
	});
	const res = await handler.fetch(req);
	const headers = new Headers(res.headers);
	for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
	return new Response(res.body, { status: res.status, headers });
}

// Stateless: no server-sent stream to open, no session to end.
const notAllowed = () => json({ error: "Method not allowed" }, 405, { Allow: "POST, OPTIONS" });
export const GET = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = preflight;
