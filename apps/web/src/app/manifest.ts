import { APPS_CONFIG } from "@/lib/app-themes";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		id: "/",
		name: "seikatsu",
		short_name: "seikatsu",
		description: "Your personal suite of tools",
		start_url: "/",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		background_color: "#0a0a0a",
		theme_color: "#0a0a0a",
		categories: ["productivity", "finance", "lifestyle"],
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{
				src: "/icons/icon-maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
		// Long-press on the home-screen icon jumps straight into an app.
		shortcuts: Object.entries(APPS_CONFIG).map(([href, { name, label }]) => ({
			name,
			short_name: name,
			description: label,
			url: href,
			icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
		})),
	};
}
