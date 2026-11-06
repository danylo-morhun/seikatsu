// The checks behind /oauth/authorize, shared by the consent page (to render) and its action
// (to issue the code) — the action never trusts what the page rendered.

import { getClient, parseScopes, redirectMatches, resourceOf, type Scope } from "./oauth";

export const AUTHORIZE_PARAMS = [
	"response_type",
	"client_id",
	"redirect_uri",
	"code_challenge",
	"code_challenge_method",
	"scope",
	"state",
	"resource",
] as const;

export type AuthorizeParams = Partial<Record<(typeof AUTHORIZE_PARAMS)[number], string>>;

export type AuthorizeRequest = {
	clientId: string;
	clientName: string;
	redirectUri: string;
	codeChallenge: string;
	scopes: Scope[];
	state: string | null;
};

/**
 * `fatal`: the redirect itself can't be trusted — show the error here, send nobody anywhere.
 * `redirect`: a valid client asked for something wrong — tell it via its redirect_uri.
 */
export type AuthorizeCheck = { ok: AuthorizeRequest } | { fatal: string } | { redirect: string };

export function errorRedirect(
	redirectUri: string,
	error: string,
	state: string | null,
	iss: string,
) {
	const url = new URL(redirectUri);
	url.searchParams.set("error", error);
	if (state) url.searchParams.set("state", state);
	url.searchParams.set("iss", iss);
	return url.toString();
}

export async function checkAuthorize(p: AuthorizeParams, origin: string): Promise<AuthorizeCheck> {
	if (!p.client_id) return { fatal: "No client_id." };
	const client = await getClient(p.client_id);
	if (!client) return { fatal: "This app isn't registered with seikatsu. Connect it again." };
	if (!p.redirect_uri || !redirectMatches(client.redirectUris, p.redirect_uri)) {
		return { fatal: "The redirect address doesn't match what this app registered." };
	}
	const state = p.state ?? null;
	const fail = (error: string) => ({
		redirect: errorRedirect(p.redirect_uri as string, error, state, origin),
	});
	if (p.response_type !== "code") return fail("unsupported_response_type");
	if (!p.code_challenge || p.code_challenge_method !== "S256") return fail("invalid_request");
	if (p.resource && p.resource.replace(/\/$/, "") !== resourceOf(origin))
		return fail("invalid_target");
	const scopes = parseScopes(p.scope);
	if (scopes.length === 0) return fail("invalid_scope");
	return {
		ok: {
			clientId: client.id,
			clientName: client.name,
			redirectUri: p.redirect_uri,
			codeChallenge: p.code_challenge,
			scopes,
			state,
		},
	};
}
