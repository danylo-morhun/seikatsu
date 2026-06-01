import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@seikatsu/ui", "@seikatsu/db"],
	async rewrites() {
		return [{ source: "/favicon.ico", destination: "/icons/favicon.svg" }];
	},
};

export default nextConfig;
