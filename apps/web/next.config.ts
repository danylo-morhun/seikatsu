import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@seikatsu/ui", "@seikatsu/db"],
	experimental: {
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
