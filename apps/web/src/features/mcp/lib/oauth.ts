// seikatsu as an OAuth 2.1 authorization server for its MCP endpoint (docs/mcp-prd.md).
// Public clients only (PKCE S256, no client secret); every code and token is random, shown
// once and stored as a sha256 hash. Not a "use server" module: the routes and the consent
// page call it after their own checks.

import { createHash, randomBytes } from "node:crypto";
import {
	and,
	authUsers,
	db,
	eq,
	gt,
	isNull,
	mcpClients,
	mcpCodes,
	mcpGrants,
	mcpTokens,
	notificationPrefs,
	or,
	workspaces,
} from "@seikatsu/db";
import { z } from "zod";
import type { Actor } from "@/lib/actor";

export const SCOPES = ["read", "write"] as const;
export type Scope = (typeof SCOPES)[number];

export const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_S = 30 * 24 * 60 * 60;
const CODE_TTL_S = 60;

export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");
const newSecret = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;

/** The public origin a request came in on (Vercel sets the forwarded headers). */
export function originOf(headers: Headers): string {
	const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
	const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
	const proto = headers.get("x-forwarded-proto") ?? (local ? "http" : "https");
	return `${proto}://${host}`;
}

export const resourceOf = (origin: string) => `${origin}/api/mcp`;

/** "read write" → the known scopes in it; nothing asked = all (the consent page can untick write). */
export function parseScopes(raw: string | null | undefined): Scope[] {
	if (!raw?.trim()) return [...SCOPES];
	const asked = new Set(raw.split(/\s+/));
	return SCOPES.filter((s) => asked.has(s));
}

// ── Clients (RFC 7591) ──────────────────────────────────────────────────────────────────

/** https anywhere, plain http only back to this machine (Claude Code's loopback callback). */
export function isAllowedRedirect(uri: string): boolean {
	try {
		const u = new URL(uri);
		if (u.hash) return false;
		if (u.protocol === "https:") return true;
		return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
	} catch {
		return false;
	}
}

export const registrationSchema = z.object({
	redirect_uris: z.array(z.string().max(2_000)).min(1).max(10),
	client_name: z.string().max(200).optional(),
	token_endpoint_auth_method: z.string().optional(),
});

export async function registerClient(input: z.infer<typeof registrationSchema>) {
	const id = `client_${randomBytes(16).toString("base64url")}`;
	const name = input.client_name?.trim() || "MCP client";
	await db.insert(mcpClients).values({ id, name, redirectUris: input.redirect_uris });
	return { id, name };
}

export async function getClient(clientId: string) {
	const [client] = await db.select().from(mcpClients).where(eq(mcpClients.id, clientId)).limit(1);
	return client ?? null;
}

/**
 * Loopback redirects match on everything but the port (RFC 8252 §7.3: native apps pick a
 * free port each run); anything else matches exactly.
 */
export function redirectMatches(registered: string[], uri: string): boolean {
	if (registered.includes(uri)) return true;
	try {
		const u = new URL(uri);
		if (u.protocol !== "http:") return false;
		return registered.some((r) => {
			const v = new URL(r);
			return v.protocol === "http:" && v.hostname === u.hostname && v.pathname === u.pathname;
		});
	} catch {
		return false;
	}
}

// ── Codes ───────────────────────────────────────────────────────────────────────────────

export async function issueCode(input: {
	clientId: string;
	workspaceId: string;
	scopes: Scope[];
	codeChallenge: string;
	redirectUri: string;
}): Promise<string> {
	const code = newSecret("sc");
	await db.insert(mcpCodes).values({
		...input,
		codeHash: hashSecret(code),
		expiresAt: new Date(Date.now() + CODE_TTL_S * 1000),
	});
	return code;
}

export type TokenResponse = {
	access_token: string;
	token_type: "Bearer";
	expires_in: number;
	refresh_token: string;
	scope: string;
};

type TokenError = { error: "invalid_grant" | "invalid_request"; error_description: string };

const pkce = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

async function issuePair(grantId: string, scopes: string[]): Promise<TokenResponse> {
	const access = newSecret("sa");
	const refresh = newSecret("sr");
	const now = Date.now();
	await db.insert(mcpTokens).values([
		{
			tokenHash: hashSecret(access),
			grantId,
			kind: "access",
			expiresAt: new Date(now + ACCESS_TTL_S * 1000),
		},
		{
			tokenHash: hashSecret(refresh),
			grantId,
			kind: "refresh",
			expiresAt: new Date(now + REFRESH_TTL_S * 1000),
		},
	]);
	return {
		access_token: access,
		token_type: "Bearer",
		expires_in: ACCESS_TTL_S,
		refresh_token: refresh,
		scope: scopes.join(" "),
	};
}

export async function exchangeCode(input: {
	code: string;
	clientId: string;
	redirectUri: string;
	codeVerifier: string;
}): Promise<TokenResponse | TokenError> {
	const bad = (d: string): TokenError => ({ error: "invalid_grant", error_description: d });
	// Claim it first, atomically: a code is good once, even when two requests race.
	const [row] = await db
		.update(mcpCodes)
		.set({ usedAt: new Date() })
		.where(
			and(
				eq(mcpCodes.codeHash, hashSecret(input.code)),
				isNull(mcpCodes.usedAt),
				gt(mcpCodes.expiresAt, new Date()),
			),
		)
		.returning();
	if (!row) return bad("Unknown, used or expired code");
	if (row.clientId !== input.clientId) return bad("Code was issued to another client");
	if (row.redirectUri !== input.redirectUri) return bad("redirect_uri does not match");
	if (pkce(input.codeVerifier) !== row.codeChallenge) return bad("PKCE verification failed");

	const client = await getClient(row.clientId);
	const [grant] = await db
		.insert(mcpGrants)
		.values({
			workspaceId: row.workspaceId,
			clientId: row.clientId,
			name: client?.name ?? "MCP client",
			scopes: row.scopes,
		})
		.returning({ id: mcpGrants.id });
	return issuePair(grant.id, row.scopes);
}

export async function refreshTokens(input: {
	refreshToken: string;
	clientId: string;
}): Promise<TokenResponse | TokenError> {
	const bad = (d: string): TokenError => ({ error: "invalid_grant", error_description: d });
	const [row] = await db
		.select({ token: mcpTokens, grant: mcpGrants })
		.from(mcpTokens)
		.innerJoin(mcpGrants, eq(mcpGrants.id, mcpTokens.grantId))
		.where(
			and(eq(mcpTokens.tokenHash, hashSecret(input.refreshToken)), eq(mcpTokens.kind, "refresh")),
		)
		.limit(1);
	if (!row || row.grant.revokedAt) return bad("Unknown or revoked refresh token");
	if (row.grant.clientId !== input.clientId) return bad("Token was issued to another client");
	if (row.token.expiresAt && row.token.expiresAt <= new Date()) return bad("Refresh token expired");

	// Rotate: the old one is spent. Seeing a spent one again means it leaked → end the grant.
	const [spent] = await db
		.update(mcpTokens)
		.set({ rotatedAt: new Date() })
		.where(and(eq(mcpTokens.tokenHash, row.token.tokenHash), isNull(mcpTokens.rotatedAt)))
		.returning({ hash: mcpTokens.tokenHash });
	if (!spent) {
		await revokeGrant(row.grant.id);
		return bad("Refresh token reused; access revoked");
	}
	return issuePair(row.grant.id, row.grant.scopes);
}

// ── Use and revoke ──────────────────────────────────────────────────────────────────────

export type Caller = {
	grantId: string;
	scopes: string[];
	workspace: typeof workspaces.$inferSelect;
	actor: Actor;
	lastUsedAt: Date | null;
};

/** The grant behind a bearer token, or null when it's unknown, expired or revoked. */
export async function verifyAccessToken(token: string): Promise<Caller | null> {
	const [row] = await db
		.select({
			grant: mcpGrants,
			workspace: workspaces,
			user: { name: authUsers.name },
			timeZone: notificationPrefs.timeZone,
		})
		.from(mcpTokens)
		.innerJoin(mcpGrants, eq(mcpGrants.id, mcpTokens.grantId))
		.innerJoin(workspaces, eq(workspaces.id, mcpGrants.workspaceId))
		.leftJoin(authUsers, eq(authUsers.id, workspaces.userId))
		.leftJoin(notificationPrefs, eq(notificationPrefs.workspaceId, workspaces.id))
		.where(
			and(
				eq(mcpTokens.tokenHash, hashSecret(token)),
				eq(mcpTokens.kind, "access"),
				isNull(mcpGrants.revokedAt),
				or(isNull(mcpTokens.expiresAt), gt(mcpTokens.expiresAt, new Date())),
			),
		)
		.limit(1);
	if (!row) return null;
	return {
		grantId: row.grant.id,
		scopes: row.grant.scopes,
		workspace: row.workspace,
		lastUsedAt: row.grant.lastUsedAt,
		actor: {
			userId: row.workspace.userId,
			name: row.user?.name ?? null,
			timeZone: row.timeZone ?? "UTC",
		},
	};
}

export async function revokeGrant(grantId: string) {
	await db.update(mcpGrants).set({ revokedAt: new Date() }).where(eq(mcpGrants.id, grantId));
}

/** RFC 7009: revoking any token of a grant ends the grant. Unknown tokens are not an error. */
export async function revokeByToken(token: string) {
	const [row] = await db
		.select({ grantId: mcpTokens.grantId })
		.from(mcpTokens)
		.where(eq(mcpTokens.tokenHash, hashSecret(token)))
		.limit(1);
	if (row) await revokeGrant(row.grantId);
}

/** A token made in Settings: no client, no expiry, shown to the user once. */
export async function createPersonalToken(workspaceId: string, name: string, scopes: Scope[]) {
	const token = newSecret("sp");
	await db.transaction(async (tx) => {
		const [grant] = await tx
			.insert(mcpGrants)
			.values({ workspaceId, clientId: null, name, scopes })
			.returning({ id: mcpGrants.id });
		await tx
			.insert(mcpTokens)
			.values({ tokenHash: hashSecret(token), grantId: grant.id, kind: "access", expiresAt: null });
	});
	return token;
}
