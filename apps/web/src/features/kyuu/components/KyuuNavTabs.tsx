"use client";

import { TravelUnderline } from "@/components/TravelUnderline";
import { useIndicator } from "@/hooks/useIndicator";
import { Briefcase01Icon, ChartLineData01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef } from "react";

const TABS = [
	{ href: "/kyuu", label: "Applications", icon: Briefcase01Icon, exact: true },
	{ href: "/kyuu/stats", label: "Stats", icon: ChartLineData01Icon, exact: false },
] as const;

// Filter params carry over between tabs; table-only params (sort/dir/page) don't.
const CARRY_PARAMS = ["status", "source", "stage", "from", "to", "q"];

export function KyuuNavTabs() {
	const pathname = usePathname();
	// One underline travels between the desktop tabs.
	const tabsRef = useRef<HTMLDivElement>(null);
	const underline = useIndicator(tabsRef, "[data-active]", pathname);
	const searchParams = useSearchParams();

	function tabHref(href: string) {
		const params = new URLSearchParams();
		for (const key of CARRY_PARAMS) {
			const value = searchParams.get(key);
			if (value) params.set(key, value);
		}
		const qs = params.toString();
		return qs ? `${href}?${qs}` : href;
	}

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
							href={tabHref(href)}
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

			{/* Mobile bottom nav */}
			<nav
				className="fixed inset-x-0 bottom-0 z-40 md:hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			>
				<div className="mx-3 mb-3">
					<div className="flex items-center justify-around rounded-2xl border border-border/60 bg-background/85 px-2 py-1.5 shadow-lg backdrop-blur-xl">
						{TABS.map(({ href, label, icon, exact }) => (
							<Link
								key={href}
								href={tabHref(href)}
								prefetch
								className={cn(
									"flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5",
									isActive(href, exact) ? "text-primary" : "text-muted-foreground",
								)}
							>
								<HugeiconsIcon icon={icon} className="h-5 w-5" />
								<span className="text-[10px] font-medium leading-none">{label}</span>
							</Link>
						))}
					</div>
				</div>
			</nav>
		</>
	);
}
