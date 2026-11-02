import * as Sentry from "@sentry/nextjs";

// Browser errors → Sentry. Errors only: no tracing, no replay (keeps the bundle small).
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
		environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
		tracesSampleRate: 0,
		defaultIntegrations: false,
		integrations: [
			Sentry.globalHandlersIntegration(),
			Sentry.linkedErrorsIntegration(),
			Sentry.dedupeIntegration(),
			Sentry.browserApiErrorsIntegration(),
		],
	});
}
