import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@seikatsu/ui", "@seikatsu/db"],
	experimental: {
		// Rewrite barrel imports to per-module imports so a page only ships the UI pieces it
		// uses (the @seikatsu/ui barrel otherwise drags recharts + calendar into every page).
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

export default nextConfig;
