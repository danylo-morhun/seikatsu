import { AppToaster } from "@/components/AppToaster";
import { NavigationProgress } from "@/components/NavigationProgress";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TimezoneSync } from "@/components/TimezoneSync";
import { OutboxSync } from "@/features/pwa/components/OutboxSync";
import { ServiceWorker } from "@/features/pwa/components/ServiceWorker";
import splashScreens from "@/features/pwa/lib/splash-screens.json";
import { TooltipProvider } from "@seikatsu/ui";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

const geistSans = Geist({
	subsets: ["latin"],
	variable: "--font-sans",
});

export const metadata: Metadata = {
	title: "seikatsu",
	description: "Your personal suite of tools",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		// Opaque: the page starts below the status bar, so iOS has nothing to blur over the header.
		statusBarStyle: "black",
		title: "seikatsu",
		startupImage: splashScreens.map(({ width, height, ratio }) => ({
			url: `/icons/splash/${width}x${height}@${ratio}.png`,
			media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
		})),
	},
	icons: {
		icon: { url: "/icons/favicon.svg", type: "image/svg+xml" },
		apple: "/icons/apple-touch-icon.png",
	},
};

export const viewport: Viewport = {
	// Content runs under the notch and home bar; the bottom navs pad by the safe-area insets.
	viewportFit: "cover",
	themeColor: "#0a0a0a",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className={geistSans.variable} suppressHydrationWarning>
			<body className="antialiased">
				<ThemeProvider>
					<Suspense>
						<NavigationProgress />
					</Suspense>
					<TooltipProvider delayDuration={0}>{children}</TooltipProvider>
					<AppToaster />
				</ThemeProvider>
				<SpeedInsights />
				<TimezoneSync />
				<ServiceWorker />
				<OutboxSync />
			</body>
		</html>
	);
}
