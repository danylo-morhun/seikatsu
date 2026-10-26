"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
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
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
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

	const litColumn = pathname.startsWith("/settings/hoshii")
		? 4
		: pathname === "/hoshii/summary"
			? 3
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

	const item = (href: string, label: string, icon: typeof InboxIcon, column: number) => {
		const active = litColumn === column;
		return (
			<Link
				href={href}
				prefetch
				aria-current={active ? "page" : undefined}
				className={cn(
					"group relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
					active ? "text-primary" : "text-muted-foreground active:text-foreground",
				)}
			>
				<span className="flex h-7 w-12 items-center justify-center">
					<HugeiconsIcon icon={icon} className="h-5 w-5" />
				</span>
				<span className="max-w-full truncate px-0.5 text-[11px] font-medium leading-none">
					{label}
				</span>
			</Link>
		);
	};

	return (
		<>
			<nav
				aria-label="Hoshii sections"
				className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				<div className="relative mx-3 mb-3 grid grid-cols-5 items-center rounded-2xl border border-rule bg-sidebar px-1 py-1.5">
					{/* One pill slides to the lit item, so the move reads as going somewhere. */}
					<span
						aria-hidden
						className="pointer-events-none absolute top-1.5 left-1 flex w-[calc((100%-0.5rem)/5)] justify-center transition-transform duration-300 ease-in-out motion-reduce:transition-none"
						style={{ transform: `translateX(${litColumn * 100}%)` }}
					>
						<span className="h-7 w-12 rounded-full bg-primary/15" />
					</span>
					{item("/hoshii", "Now", InboxIcon, 0)}
					{item("/hoshii/lists", "Lists", GridViewIcon, 1)}
					<div className="relative flex items-center justify-center">
						<Button
							size="icon"
							aria-label="Add a want"
							className="h-11 w-11 rounded-full"
							onClick={() => requestAdd()}
						>
							<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
						</Button>
					</div>
					{item("/hoshii/summary", "Summary", ChartHistogramIcon, 3)}
					{item("/settings/hoshii", "Settings", Settings01Icon, 4)}
				</div>
			</nav>

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
