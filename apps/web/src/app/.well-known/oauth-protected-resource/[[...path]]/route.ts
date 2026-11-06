import type { NextRequest } from "next/server";
import { json, preflight } from "@/features/mcp/lib/http";
import { originOf, resourceOf, SCOPES } from "@/features/mcp/lib/oauth";

// RFC 9728: where /api/mcp's tokens come from. Served bare and with the resource path
// appended (/.well-known/oauth-protected-resource/api/mcp), as clients try both.
export function GET(req: NextRequest) {
	const origin = originOf(req.headers);
	return json({
		resource: resourceOf(origin),
		authorization_servers: [origin],
		scopes_supported: SCOPES,
		bearer_methods_supported: ["header"],
		resource_name: "seikatsu",
	});
}

export const OPTIONS = preflight;
