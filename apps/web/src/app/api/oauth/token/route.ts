import type { NextRequest } from "next/server";
import { json, preflight, readParams } from "@/features/mcp/lib/http";
import { exchangeCode, refreshTokens } from "@/features/mcp/lib/oauth";

// RFC 6749 token endpoint for public clients: code + PKCE verifier, or a refresh token
// (rotated on every use).
export async function POST(req: NextRequest) {
	const p = await readParams(req);
	const missing = () =>
		json({ error: "invalid_request", error_description: "Missing parameters" }, 400);
	if (!p.client_id)
		return json({ error: "invalid_client", error_description: "client_id required" }, 401);

	let result: Awaited<ReturnType<typeof exchangeCode>>;
	if (p.grant_type === "authorization_code") {
		if (!p.code || !p.redirect_uri || !p.code_verifier) return missing();
		result = await exchangeCode({
			code: p.code,
			clientId: p.client_id,
			redirectUri: p.redirect_uri,
			codeVerifier: p.code_verifier,
		});
	} else if (p.grant_type === "refresh_token") {
		if (!p.refresh_token) return missing();
		result = await refreshTokens({ refreshToken: p.refresh_token, clientId: p.client_id });
	} else {
		return json({ error: "unsupported_grant_type" }, 400);
	}
	return "error" in result ? json(result, 400) : json(result);
}

export const OPTIONS = preflight;
