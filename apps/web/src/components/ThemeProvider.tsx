"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * next-themes injects the pre-paint script that applies the saved theme (no flash) and keeps
 * tabs in sync. It renders next to the app, not around it: right after mount it updates its
 * context (system colour scheme), and an urgent context change above a page segment whose JS
 * hasn't loaded yet makes React drop that segment's server HTML and show the loading screen
 * again. ThemeToggle switches the theme itself (see lib/theme.ts).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
	return (
		<>
			<NextThemesProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
				{null}
			</NextThemesProvider>
			{children}
		</>
	);
}
