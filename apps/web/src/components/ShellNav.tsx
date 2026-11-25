"use client";

import { QuillWrite01Icon } from "@hugeicons/core-free-icons";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { SHELL } from "@/components/AppSidebar";
import { useModules } from "@/components/ModulesProvider";
import { TabBar, TabBarAction } from "@/components/TabBar";
import { openCapture } from "@/features/capture/lib/key";
import { APPS_CONFIG } from "@/lib/app-themes";
import { type AppHref, pathIsOn } from "@/lib/modules";

/** Home, Week and Goals: the shell's own pages (everything else is an app or settings). */
export const isShellPage = (pathname: string) =>
	pathname === "/" || pathname === "/week" || pathname === "/goals";

const ORIGIN_KEY = "seikatsu:origin";

/** Where the user came into an app from, for its back button; Home when unknown. */
export function shellOrigin(): string {
	try {
		return sessionStorage.getItem(ORIGIN_KEY) ?? "/";
	} catch {
		return "/";
	}
}

/**
 * Phones: the shell's bar on its own pages (an app shows its own tabs instead). Everywhere:
 * remembers the last shell page, so an app's back button returns there.
 */
export function ShellNav() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const shell = isShellPage(pathname);
	const query = searchParams.toString();
	const on = useModules();

	useEffect(() => {
		if (!shell) return;
		try {
			sessionStorage.setItem(ORIGIN_KEY, query ? `${pathname}?${query}` : pathname);
		} catch {
			// No storage: back goes Home.
		}
	}, [shell, pathname, query]);

	if (!shell) return null;
	const places = SHELL.filter((s) => pathIsOn(s.href, on));
	// The bar holds four: the shell's places that are on, then the first apps on the dashboard.
	const apps = on
		.filter((m): m is AppHref => m in APPS_CONFIG)
		.slice(0, Math.max(0, 4 - places.length))
		.map((href) => ({
			href,
			label: APPS_CONFIG[href].name,
			glyph: { kanji: APPS_CONFIG[href].kanji, theme: APPS_CONFIG[href].theme },
		}));
	return (
		<TabBar
			label="seikatsu"
			active={places.findIndex((s) => s.match(pathname, searchParams.get("v")))}
			items={[...places.map(({ to, label, icon }) => ({ href: to, label, icon })), ...apps]}
			action={
				<TabBarAction icon={QuillWrite01Icon} aria-label="Capture" onClick={() => openCapture()} />
			}
		/>
	);
}
