import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "./fixtures";

// Claude's way in (docs/mcp-prd.md): register → consent → code → token → tools, on the prod build.
const REDIRECT = "http://localhost:9999/callback";

test("an MCP client connects through consent and reads Today", async ({ page, request }) => {
	const reg = await request.post("/api/oauth/register", {
		data: { client_name: "E2E client", redirect_uris: [REDIRECT] },
	});
	expect(reg.status()).toBe(201);
	const { client_id } = await reg.json();

	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	const params = new URLSearchParams({
		response_type: "code",
		client_id,
		redirect_uri: REDIRECT,
		code_challenge: challenge,
		code_challenge_method: "S256",
		state: "e2e",
	});

	// The client's callback isn't running: catch the redirect instead of following it.
	let callback: URL | null = null;
	await page.route(`${REDIRECT}**`, (route) => {
		callback = new URL(route.request().url());
		return route.fulfill({ status: 200, body: "ok" });
	});
	await page.goto(`/oauth/authorize?${params}`);
	await expect(page.getByRole("heading", { name: "Connect E2E client" })).toBeVisible();
	await page.getByRole("checkbox", { name: /Make changes/ }).click();
	await page.getByRole("button", { name: "Allow" }).click();
	await expect.poll(() => callback?.searchParams.get("state")).toBe("e2e");
	const code = (callback as URL | null)?.searchParams.get("code") ?? "";

	const tokenRes = await request.post("/api/oauth/token", {
		form: {
			grant_type: "authorization_code",
			code,
			client_id,
			redirect_uri: REDIRECT,
			code_verifier: verifier,
		},
	});
	expect(tokenRes.ok()).toBe(true);
	const tokens = await tokenRes.json();
	expect(tokens.scope).toBe("read");

	// A JSON body or a one-event SSE stream: the spec allows both, clients read both.
	const rpc = async (method: string, params: object) => {
		const res = await request.post("/api/mcp", {
			headers: {
				authorization: `Bearer ${tokens.access_token}`,
				accept: "application/json, text/event-stream",
			},
			data: { jsonrpc: "2.0", id: 1, method, params },
		});
		const text = await res.text();
		const data = text.startsWith("{") ? text : (text.match(/^data: (.*)$/m)?.[1] ?? "null");
		return JSON.parse(data);
	};
	const list = await rpc("tools/list", {});
	const names: string[] = list.result.tools.map((t: { name: string }) => t.name);
	expect(names).toContain("today");
	// Write was unticked on the consent page: no write tools.
	expect(names).not.toContain("kuroji_add_transaction");

	const today = await rpc("tools/call", { name: "today", arguments: {} });
	expect(today.result.isError).toBeUndefined();
	expect(JSON.parse(today.result.content[0].text)).toHaveProperty("today");

	const anon = await request.post("/api/mcp", { data: {} });
	expect(anon.status()).toBe(401);
	expect(anon.headers()["www-authenticate"]).toContain("resource_metadata=");
});
