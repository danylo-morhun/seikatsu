"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
	AUTHORIZE_PARAMS,
	type AuthorizeParams,
	checkAuthorize,
	errorRedirect,
} from "@/features/mcp/lib/authorize";
import { issueCode, originOf } from "@/features/mcp/lib/oauth";
import { requireWorkspace } from "@/lib/session";

function paramsOf(form: FormData): AuthorizeParams {
	return Object.fromEntries(
		AUTHORIZE_PARAMS.flatMap((k) => {
			const v = form.get(k);
			return typeof v === "string" && v ? [[k, v]] : [];
		}),
	);
}

/** Allow / Deny on the consent page. Re-checks everything: the form is only a messenger. */
export async function answerConsent(form: FormData) {
	const workspace = await requireWorkspace();
	const origin = originOf(await headers());
	const check = await checkAuthorize(paramsOf(form), origin);
	if ("fatal" in check) throw new Error(check.fatal);
	if ("redirect" in check) redirect(check.redirect);
	const req = check.ok;

	if (form.get("decision") !== "allow") {
		redirect(errorRedirect(req.redirectUri, "access_denied", req.state, origin));
	}
	// Write is offered only when asked for, and the user may still untick it.
	const scopes = req.scopes.filter((s) => s === "read" || form.get("write") === "on");
	const code = await issueCode({
		clientId: req.clientId,
		workspaceId: workspace.id,
		scopes: scopes.includes("read") ? scopes : ["read", ...scopes],
		codeChallenge: req.codeChallenge,
		redirectUri: req.redirectUri,
	});
	const url = new URL(req.redirectUri);
	url.searchParams.set("code", code);
	if (req.state) url.searchParams.set("state", req.state);
	url.searchParams.set("iss", origin);
	redirect(url.toString());
}
