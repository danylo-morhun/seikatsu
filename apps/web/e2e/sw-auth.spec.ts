import { createHash, randomBytes } from "node:crypto";
import { db, eq, verificationTokens } from "@seikatsu/db";
import { AUTH_SECRET, E2E_USER } from "./env";
import { expect, test } from "./fixtures";

// Sign-in callbacks carry a one-time secret (an OAuth code, a magic-link token). With the
// service worker's navigation preload on, a navigation it doesn't answer goes out twice and
// the second use of the secret fails — "Server error" after Google sign-in. Once, always.
test.use({ storageState: { cookies: [], origins: [] } });

test("a sign-in callback reaches the server once under the service worker", async ({ page }) => {
	await page.goto("/");
	await page.waitForFunction(async () => {
		await navigator.serviceWorker.ready;
		return !!navigator.serviceWorker.controller;
	});

	const token = randomBytes(32).toString("hex");
	await db.insert(verificationTokens).values({
		identifier: E2E_USER.email,
		token: createHash("sha256").update(`${token}${AUTH_SECRET}`).digest("hex"),
		expires: new Date(Date.now() + 10 * 60_000),
	});

	const url = `/api/auth/callback/resend?${new URLSearchParams({ callbackUrl: "/", token, email: E2E_USER.email })}`;
	await page.goto(url);

	await expect(page).not.toHaveURL(/\/api\/auth\/error/);
	await expect(page.getByRole("link", { name: "Today" }).first()).toBeVisible();
	// Used once, and by the request whose answer the browser kept.
	const left = await db
		.select()
		.from(verificationTokens)
		.where(eq(verificationTokens.identifier, E2E_USER.email));
	expect(left).toEqual([]);
});
