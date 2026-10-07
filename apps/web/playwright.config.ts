import { defineConfig, devices } from "@playwright/test";
import { AUTH_SECRET, BASE_URL, DATABASE_URL, PORT } from "./e2e/env";

// E2E runs against a production build (`next build` first): the Next 15.5 bug where a
// transition hung after a server action only reproduced there, never in `next dev`.
export default defineConfig({
	testDir: "./e2e",
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: BASE_URL,
		timezoneId: "UTC",
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "setup", testMatch: /auth\.setup\.ts/ },
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
			dependencies: ["setup"],
		},
	],
	webServer: {
		command: `pnpm start -p ${PORT}`,
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		// Explicit values win over apps/web/.env.local, which holds production secrets.
		env: { DATABASE_URL, AUTH_SECRET, AUTH_URL: BASE_URL },
	},
});
