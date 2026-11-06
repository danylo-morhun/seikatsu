import { createHash } from "node:crypto";
import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Scope } from "./oauth";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));

const oauth = await import("./oauth");
const { checkAuthorize } = await import("./authorize");

const ORIGIN = "https://seikatsu.test";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "a-long-random-verifier-string-for-pkce-0123456789";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");

let workspaceId: string;
let clientId: string;

async function newCode(scopes: Scope[] = ["read", "write"]) {
	return oauth.issueCode({
		clientId,
		workspaceId,
		scopes,
		codeChallenge: CHALLENGE,
		redirectUri: REDIRECT,
	});
}

describe("MCP OAuth", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
		await testDb.insert(schema.authUsers).values({ id: "user-1", email: "u@test", name: "U" });
		const [ws] = await testDb
			.insert(schema.workspaces)
			.values({ userId: "user-1", name: "Test", baseCurrency: "PLN" })
			.returning();
		workspaceId = ws.id;
		clientId = (await oauth.registerClient({ client_name: "Claude", redirect_uris: [REDIRECT] }))
			.id;
	});

	it("accepts https and loopback redirects only", () => {
		expect(oauth.isAllowedRedirect(REDIRECT)).toBe(true);
		expect(oauth.isAllowedRedirect("http://localhost:33418/callback")).toBe(true);
		expect(oauth.isAllowedRedirect("http://evil.example/callback")).toBe(false);
		expect(oauth.isAllowedRedirect("javascript:alert(1)")).toBe(false);
		expect(
			oauth.redirectMatches(["http://localhost:1/callback"], "http://localhost:5555/callback"),
		).toBe(true);
		expect(oauth.redirectMatches([REDIRECT], "https://claude.ai/other")).toBe(false);
	});

	it("checks the authorize request before anything else", async () => {
		const base = {
			response_type: "code",
			client_id: clientId,
			redirect_uri: REDIRECT,
			code_challenge: CHALLENGE,
			code_challenge_method: "S256",
			state: "s1",
		};
		expect(await checkAuthorize(base, ORIGIN)).toMatchObject({
			ok: { clientName: "Claude", scopes: ["read", "write"] },
		});
		expect(await checkAuthorize({ ...base, client_id: "nope" }, ORIGIN)).toHaveProperty("fatal");
		expect(
			await checkAuthorize({ ...base, redirect_uri: "https://evil.example/cb" }, ORIGIN),
		).toHaveProperty("fatal");
		const plain = await checkAuthorize({ ...base, code_challenge_method: "plain" }, ORIGIN);
		expect("redirect" in plain && plain.redirect).toContain("error=invalid_request");
		const target = await checkAuthorize(
			{ ...base, resource: "https://other.test/api/mcp" },
			ORIGIN,
		);
		expect("redirect" in target && target.redirect).toContain("error=invalid_target");
	});

	it("trades a code once, with the right verifier", async () => {
		const code = await newCode();
		const wrong = await oauth.exchangeCode({
			code,
			clientId,
			redirectUri: REDIRECT,
			codeVerifier: "x".repeat(50),
		});
		expect(wrong).toMatchObject({ error: "invalid_grant" });
		// The failed try spent it: a code is good for one attempt.
		const again = await oauth.exchangeCode({
			code,
			clientId,
			redirectUri: REDIRECT,
			codeVerifier: VERIFIER,
		});
		expect(again).toMatchObject({ error: "invalid_grant" });

		const fresh = await newCode();
		const tokens = await oauth.exchangeCode({
			code: fresh,
			clientId,
			redirectUri: REDIRECT,
			codeVerifier: VERIFIER,
		});
		expect(tokens).toMatchObject({ token_type: "Bearer", scope: "read write" });
		if ("error" in tokens) throw new Error("no tokens");
		const caller = await oauth.verifyAccessToken(tokens.access_token);
		expect(caller).toMatchObject({
			workspace: { id: workspaceId },
			actor: { userId: "user-1", timeZone: "UTC" },
		});
		expect(await oauth.verifyAccessToken(tokens.refresh_token)).toBeNull();
	});

	it("rotates refresh tokens and ends the grant when an old one comes back", async () => {
		const tokens = await oauth.exchangeCode({
			code: await newCode(["read"]),
			clientId,
			redirectUri: REDIRECT,
			codeVerifier: VERIFIER,
		});
		if ("error" in tokens) throw new Error("no tokens");
		const next = await oauth.refreshTokens({ refreshToken: tokens.refresh_token, clientId });
		if ("error" in next) throw new Error("no refresh");
		expect(next.scope).toBe("read");
		expect(await oauth.verifyAccessToken(next.access_token)).not.toBeNull();

		const replayed = await oauth.refreshTokens({ refreshToken: tokens.refresh_token, clientId });
		expect(replayed).toMatchObject({ error: "invalid_grant" });
		expect(await oauth.verifyAccessToken(next.access_token)).toBeNull();
	});

	it("revokes by any token of the grant", async () => {
		const token = await oauth.createPersonalToken(workspaceId, "Script", ["read"]);
		expect(await oauth.verifyAccessToken(token)).toMatchObject({ scopes: ["read"] });
		await oauth.revokeByToken(token);
		expect(await oauth.verifyAccessToken(token)).toBeNull();
	});
});
