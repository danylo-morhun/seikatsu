// The browser SDK is ~130 KB gz and Turbopack can't tree-shake it, so it stays out of the
// main bundle: loaded once on idle (instrumentation-client.ts) or on a crash (global-error.tsx).
// Errors thrown before it loads aren't reported. No DSN = never loaded.
let sentry: Promise<typeof import("@sentry/nextjs")> | undefined;

export function loadSentry() {
	if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return undefined;
	sentry ??= import("@sentry/nextjs").then((Sentry) => {
		Sentry.init({
			dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
			environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
			tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
		});
		return Sentry;
	});
	return sentry;
}
