// Shared by playwright.config.ts (server env) and the tests (DB seed, session cookie).
export const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;
export const AUTH_SECRET = process.env.AUTH_SECRET ?? "e2e-local-auth-secret-not-for-production";
export const DATABASE_URL = process.env.DATABASE_URL ?? "";

// Tests write to the DB — never let them near Neon (.env points at production).
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL)) {
	throw new Error("E2E needs DATABASE_URL pointing at a local Postgres (localhost)");
}

export const E2E_USER = { id: "e2e-user", email: "e2e@seikatsu.test", name: "E2E User" };
