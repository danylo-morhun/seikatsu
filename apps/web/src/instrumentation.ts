import * as Sentry from "@sentry/nextjs";

// Server errors → Sentry. No DSN (local, CI, previews without it) = no-op.
export function register() {
	if (!process.env.SENTRY_DSN) return;
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.VERCEL_ENV ?? "development",
		tracesSampleRate: 0,
	});
}

export const onRequestError = Sentry.captureRequestError;
