"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { TabBar, TabBarAction } from "@/components/TabBar";
import type { ChromeData } from "@/features/hoshii/actions/data";
import { ItemDialog } from "@/features/hoshii/components/ItemDialog";
import { ADD_EVENT, requestAdd } from "@/features/hoshii/lib/events";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Add01Icon,
	ChartHistogramIcon,
	GridViewIcon,
	InboxIcon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Hoshii's chrome around every page of the app: the phone's bottom pill (Now, Lists, add,
 * Summary, Settings), the Add dialog it, the header and a shared shop link open, and the
 * app-wide keys.
 */
export function HoshiiChrome({ chrome }: { chrome: ChromeData }) {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [add, setAdd] = useState<{ open: boolean; instant: boolean; url?: string }>({
		open: false,
		instant: false,
	});

	const lit = pathname.startsWith("/settings/hoshii")
		? 3
		: pathname === "/hoshii/summary"
			? 2
			: pathname === "/hoshii/lists"
				? 1
				: 0;

	// Shared from a shop app (/hoshii/share → ?add=…): open with the link, then tidy the URL.
	const shared = searchParams.get("add");
	useEffect(() => {
		if (!shared) return;
		setAdd({ open: true, instant: false, url: shared });
		router.replace(pathname, { scroll: false });
	}, [shared, pathname, router]);

	// N adds a want; 1–3 go to the pages, "," to settings.
	useEffect(() => {
		function go(href: string) {
			startNavigationProgress();
			router.push(href);
		}
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "n") setAdd({ open: true, instant: true });
			else if (k === "1") go("/hoshii");
			else if (k === "2") go("/hoshii/lists");
			else if (k === "3") go("/hoshii/summary");
			else if (k === ",") go("/settings/hoshii");
			else return;
			e.preventDefault();
		}
		function onAdd(e: Event) {
			const url = (e as CustomEvent<{ url?: string }>).detail?.url;
			setAdd({ open: true, instant: false, url });
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(ADD_EVENT, onAdd);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(ADD_EVENT, onAdd);
		};
	}, [router]);

	return (
		<>
			<TabBar
				label="Hoshii sections"
				active={lit}
				items={[
					{ label: "Now", icon: InboxIcon, href: "/hoshii" },
					{ label: "Lists", icon: GridViewIcon, href: "/hoshii/lists" },
					{ label: "Summary", icon: ChartHistogramIcon, href: "/hoshii/summary" },
					{ label: "Settings", icon: Settings01Icon, href: "/settings/hoshii" },
				]}
				action={
					<TabBarAction icon={Add01Icon} aria-label="Add a want" onClick={() => requestAdd()} />
				}
			/>

			<ItemDialog
				open={add.open}
				instant={add.instant}
				onOpenChange={(open) => setAdd((a) => ({ ...a, open, url: open ? a.url : undefined }))}
				chrome={chrome}
				initialUrl={add.url}
			/>
		</>
	);
}
