import * as Sentry from "@sentry/nextjs";

// Server errors and traces → Sentry. No DSN (local, CI, previews without it) = no-op.
export function register() {
	if (!process.env.SENTRY_DSN) return;
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.VERCEL_ENV ?? "development",
		tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
	});
}

export const onRequestError = Sentry.captureRequestError;
