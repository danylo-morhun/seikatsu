"use client";

import { QuillWrite01Icon } from "@hugeicons/core-free-icons";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { SHELL } from "@/components/AppSidebar";
import { TabBar, TabBarAction } from "@/components/TabBar";
import { openCapture } from "@/features/capture/lib/key";

/** Today, Week, Goals and Apps: the shell's own pages (everything else is an app or settings). */
export const isShellPage = (pathname: string) =>
	pathname === "/" || pathname === "/week" || pathname === "/goals" || pathname === "/apps";

const ORIGIN_KEY = "seikatsu:origin";

/** Where the user came into an app from, for its back button; Today when unknown. */
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

	useEffect(() => {
		if (!shell) return;
		try {
			sessionStorage.setItem(ORIGIN_KEY, query ? `${pathname}?${query}` : pathname);
		} catch {
			// No storage: back goes to Today.
		}
	}, [shell, pathname, query]);

	if (!shell) return null;
	return (
		<TabBar
			label="seikatsu"
			active={SHELL.findIndex((s) => s.match(pathname))}
			items={SHELL.map(({ href, label, icon }) => ({ href, label, icon }))}
			action={
				<TabBarAction icon={QuillWrite01Icon} aria-label="Capture" onClick={() => openCapture()} />
			}
		/>
	);
}
