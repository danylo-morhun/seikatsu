import type { NextRequest } from "next/server";
import { json, preflight } from "@/features/mcp/lib/http";
import { originOf, SCOPES } from "@/features/mcp/lib/oauth";

// RFC 8414: seikatsu's own authorization server for the MCP endpoint (docs/mcp-prd.md).
export function GET(req: NextRequest) {
	const origin = originOf(req.headers);
	return json({
		issuer: origin,
		authorization_endpoint: `${origin}/oauth/authorize`,
		token_endpoint: `${origin}/api/oauth/token`,
		registration_endpoint: `${origin}/api/oauth/register`,
		revocation_endpoint: `${origin}/api/oauth/revoke`,
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["none"],
		revocation_endpoint_auth_methods_supported: ["none"],
		scopes_supported: SCOPES,
	});
}

export const OPTIONS = preflight;
