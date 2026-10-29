"use client";

import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { OfflineWarmup } from "@/features/pwa/components/OfflineWarmup";
import { APP_THEMES, getThemeForPath } from "@/lib/app-themes";
import { SidebarInset, SidebarProvider } from "@seikatsu/ui";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const ALL_THEMES = Object.values(APP_THEMES);

interface User {
	id: string;
	name?: string | null;
	email?: string | null;
	image?: string | null;
}

interface Props {
	workspaceName: string;
	hiddenApps?: string[];
	workspaceId?: string;
	baseCurrency?: string;
	sidebarDefaultOpen?: boolean;
	user?: User | null;
	children: React.ReactNode;
}

export function AppShell({
	workspaceName,
	hiddenApps = [],
	workspaceId,
	baseCurrency,
	sidebarDefaultOpen = true,
	user,
	children,
}: Props) {
	const pathname = usePathname();
	const theme = getThemeForPath(pathname);

	// Apply theme to body so portaled elements (Dialog, Popover etc.) get themed
	useEffect(() => {
		document.body.classList.remove(...ALL_THEMES);
		if (theme) document.body.classList.add(theme);
		return () => {
			document.body.classList.remove(...ALL_THEMES);
		};
	}, [theme]);

	// A Radix menu or sheet closed by navigating away can unmount without handing the page back:
	// body keeps `pointer-events: none` and nothing on the new page takes a tap. Once the route
	// has settled (closing layers finish their exit) with no layer open, give it back.
	useEffect(() => {
		const timer = setTimeout(() => {
			const layerOpen = document.querySelector(
				'[data-state="open"]:is([role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"])',
			);
			if (!layerOpen && document.body.style.pointerEvents === "none") {
				document.body.style.pointerEvents = "";
			}
		}, 500);
		return () => clearTimeout(timer);
	}, [pathname]);

	return (
		<SidebarProvider defaultOpen={sidebarDefaultOpen} className={theme}>
			<AppSidebar workspaceName={workspaceName} hiddenApps={hiddenApps} user={user} />
			<SidebarInset className="min-w-0">
				<AppHeader workspaceId={workspaceId} baseCurrency={baseCurrency} />
				{children}
			</SidebarInset>
			<KeyboardShortcuts />
			<OfflineWarmup />
		</SidebarProvider>
	);
}
