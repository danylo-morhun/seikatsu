import { NavigationProgress } from "@/components/NavigationProgress";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TimezoneSync } from "@/components/TimezoneSync";
import { TooltipProvider } from "@seikatsu/ui";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
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
		statusBarStyle: "black-translucent",
		title: "seikatsu",
	},
	icons: {
		icon: { url: "/icons/favicon.svg", type: "image/svg+xml" },
		apple: "/icons/apple-touch-icon.png",
	},
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
					<Toaster richColors position="bottom-right" />
				</ThemeProvider>
				<SpeedInsights />
				<TimezoneSync />
			</body>
		</html>
	);
}
