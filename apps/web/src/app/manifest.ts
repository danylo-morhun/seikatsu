import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "seikatsu",
		short_name: "seikatsu",
		description: "Your personal suite of tools",
		start_url: "/",
		display: "standalone",
		orientation: "portrait",
		background_color: "#0a0a0a",
		theme_color: "#0a0a0a",
		icons: [
			{
				src: "/icons/favicon.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "any",
			},
		],
	};
}
