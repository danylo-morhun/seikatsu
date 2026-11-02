import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@seikatsu/ui", "@seikatsu/db"],
	experimental: {
		// Rewrite barrel imports of these packages to per-module imports. For @seikatsu/ui this
		// alone didn't tree-shake under Turbopack; `sideEffects` in its package.json does (without
		// it the root layout shipped the whole UI lib, calendar included, to every page).
		optimizePackageImports: ["@seikatsu/ui", "@hugeicons/core-free-icons", "date-fns"],
		// Keep visited/prefetched pages in the client router cache so tab switches and
		// back/forward are instant. Server actions that revalidate clear it.
		staleTimes: {
			dynamic: 30,
			static: 180,
		},
		serverActions: {
			bodySizeLimit: "6mb",
		},
	},
	env: {
		// Versions the service worker URL (features/pwa/lib/sw-client.ts): one worker per deploy.
		NEXT_PUBLIC_BUILD_ID: (
			process.env.VERCEL_GIT_COMMIT_SHA ??
			process.env.GITHUB_SHA ??
			"dev"
		).slice(0, 12),
	},
	async headers() {
		return [
			{
				source: "/sw.js",
				headers: [
					{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
					{ key: "Service-Worker-Allowed", value: "/" },
				],
			},
		];
	},
	async rewrites() {
		return [{ source: "/favicon.ico", destination: "/icons/favicon.svg" }];
	},
};

// Source maps go to Sentry only when SENTRY_AUTH_TOKEN is set (Vercel production builds).
export default withSentryConfig(nextConfig, {
	org: "danylo-morhun",
	project: "seikatsu",
	silent: !process.env.CI,
	telemetry: false,
	sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
	widenClientFileUpload: true,
});
