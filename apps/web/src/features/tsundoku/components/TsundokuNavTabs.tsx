"use client";

import { TravelUnderline } from "@/components/TravelUnderline";
import { AddBookModal } from "@/features/tsundoku/components/AddBookModal";
import { useIndicator } from "@/hooks/useIndicator";
import { Add01Icon, Book01Icon, Chart01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const TABS = [
	{ href: "/tsundoku", label: "Library", icon: Book01Icon, exact: true },
	{ href: "/tsundoku/stats", label: "Stats", icon: Chart01Icon, exact: false },
] as const;

export function TsundokuNavTabs() {
	const pathname = usePathname();
	// One underline travels between the desktop tabs.
	const tabsRef = useRef<HTMLDivElement>(null);
	const underline = useIndicator(tabsRef, "[data-active]", pathname);

	function isActive(href: string, exact: boolean) {
		return exact ? pathname === href : pathname.startsWith(href);
	}

	return (
		<>
			{/* Desktop tab nav */}
			<div className="hidden border-b border-border/60 md:block">
				<div ref={tabsRef} className="relative flex items-center gap-1 px-4 sm:px-6">
					{TABS.map(({ href, label, icon, exact }) => (
						<Link
							key={href}
							href={href}
							prefetch
							data-active={isActive(href, exact) || undefined}
							className={cn(
								"flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors",
								isActive(href, exact)
									? "text-primary"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<HugeiconsIcon icon={icon} className="h-4 w-4" />
							{label}
						</Link>
					))}
					<TravelUnderline indicator={underline} />
				</div>
			</div>

			{/* Mobile bottom nav + FAB */}
			<nav
				className="fixed inset-x-0 bottom-0 z-40 md:hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			>
				<div className="mx-3 mb-3">
					<div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/85 px-2 py-1.5 shadow-lg backdrop-blur-xl">
						<Link
							href="/tsundoku"
							prefetch
							className={cn(
								"flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5",
								isActive("/tsundoku", true) ? "text-primary" : "text-muted-foreground",
							)}
						>
							<HugeiconsIcon icon={Book01Icon} className="h-5 w-5" />
							<span className="text-[10px] font-medium leading-none">Library</span>
						</Link>

						<div className="flex shrink-0 items-center justify-center px-1">
							<AddBookModal
								trigger={
									<Button
										size="icon"
										className="h-11 w-11 rounded-full shadow-lg shadow-primary/25"
									>
										<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
									</Button>
								}
							/>
						</div>

						<Link
							href="/tsundoku/stats"
							prefetch
							className={cn(
								"flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5",
								isActive("/tsundoku/stats", false) ? "text-primary" : "text-muted-foreground",
							)}
						>
							<HugeiconsIcon icon={Chart01Icon} className="h-5 w-5" />
							<span className="text-[10px] font-medium leading-none">Stats</span>
						</Link>
					</div>
				</div>
			</nav>
		</>
	);
}
