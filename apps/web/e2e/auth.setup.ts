import { expect, test as setup } from "@playwright/test";
import { authUsers, db } from "@seikatsu/db";
import { encode } from "next-auth/jwt";
import { AUTH_SECRET, E2E_USER } from "./env";

const COOKIE = "authjs.session-token";

// Signs in without OAuth: seed the user and mint the JWT session cookie NextAuth would set.
// The app creates the workspace and starter accounts on the first visit.
setup("sign in", async ({ page }) => {
	await db.insert(authUsers).values(E2E_USER).onConflictDoNothing();

	const token = await encode({
		token: { sub: E2E_USER.id, name: E2E_USER.name, email: E2E_USER.email },
		secret: AUTH_SECRET,
		salt: COOKIE,
	});
	const cookie = { domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const };
	await page.context().addCookies([
		{ ...cookie, name: COOKIE, value: token },
		// Same zone as the browser (timezoneId) so the server's "today" matches the client's.
		{ ...cookie, name: "tz", value: "UTC", httpOnly: false },
	]);

	await page.goto("/kuroji");
	await expect(page).toHaveURL(/\/kuroji/);
	await expect(
		page.locator("header").getByRole("button", { name: "New Transaction" }),
	).toBeVisible();

	await page.context().storageState({ path: "e2e/.auth/user.json" });
});
