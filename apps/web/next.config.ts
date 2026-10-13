import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@seikatsu/ui", "@seikatsu/db"],
	images: {
		// Book covers are pasted from any shop or library site. src/proxy.ts keeps the optimizer
		// to signed-in users so it isn't an open image proxy.
		remotePatterns: [{ protocol: "https", hostname: "**" }],
		formats: ["image/avif", "image/webp"],
		// Covers are small tiles: fewer widths, fewer transformations.
		deviceSizes: [640, 1080, 1920],
		imageSizes: [64, 96, 160, 320],
		minimumCacheTTL: 2_678_400,
	},
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
	async rewrites() {
		return [{ source: "/favicon.ico", destination: "/icons/favicon.svg" }];
	},
};

export default nextConfig;
