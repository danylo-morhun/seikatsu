"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { type KurojiTab, buildTabHref } from "@/features/kuroji/lib/tabs";
import { getAppForPath } from "@/lib/app-themes";
import { SidebarTrigger, cn } from "@seikatsu/ui";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Kuroji-only controls load on demand so the other apps' shells don't ship the
// form/date-picker code (zod, react-hook-form, react-day-picker).
const DateRangePicker = dynamic(
	() => import("@/features/kuroji/components/DateRangePicker").then((m) => m.DateRangePicker),
	{ loading: () => <div className="h-9 w-32" /> },
);
const AddTransactionModal = dynamic(
	() =>
		import("@/features/kuroji/components/AddTransactionModal").then((m) => m.AddTransactionModal),
	{ loading: () => <div className="h-9 w-40" /> },
);

const KUROJI_TABS: { value: KurojiTab; label: string }[] = [
	{ value: "expense", label: "Expenses" },
	{ value: "accounts", label: "Accounts" },
	{ value: "transactions", label: "Transactions" },
];

interface Props {
	workspaceId?: string;
	baseCurrency?: string;
}

export function AppHeader({ workspaceId, baseCurrency }: Props) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const app = getAppForPath(pathname);

	const isKurojiHome = pathname === "/kuroji";
	const isKuroji = pathname.startsWith("/kuroji");
	const activeTab = (searchParams.get("tab") as KurojiTab) || "expense";
	// Highlight the clicked tab immediately; the URL catches up when navigation commits.
	const [pendingTab, setPendingTab] = useState<KurojiTab | null>(null);
	const displayTab = pendingTab ?? activeTab;

	useEffect(() => {
		setPendingTab(null);
	}, [activeTab, pathname]);

	// One underline that travels between tabs, so the eye follows where you went.
	const navRef = useRef<HTMLElement>(null);
	const [underline, setUnderline] = useState<{ x: number; w: number; moved: boolean } | null>(null);
	useLayoutEffect(() => {
		const nav = navRef.current;
		if (!nav) return;
		function place() {
			const label = nav?.querySelector<HTMLElement>(`[data-tab="${displayTab}"] > span`);
			if (!label) return;
			const link = label.parentElement as HTMLElement;
			const x = link.offsetLeft + label.offsetLeft + 10;
			const w = label.offsetWidth - 20;
			// The first placement lands without travelling; only later moves animate.
			setUnderline((prev) => ({ x, w, moved: prev !== null }));
		}
		place();
		window.addEventListener("resize", place);
		return () => window.removeEventListener("resize", place);
	}, [displayTab]);

	function tabHref(tab: KurojiTab) {
		return buildTabHref(tab, searchParams.toString());
	}

	return (
		<header className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2">
			<SidebarTrigger className="h-7 w-7 [&>svg]:h-4 [&>svg]:w-4" />
			<div aria-hidden className="h-4 w-px shrink-0 bg-border" />

			<Link
				href={app?.href ?? "/"}
				className="ml-2 flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				{app && <span className="text-primary">{app.kanji}</span>}
				<span className={cn("truncate", isKurojiHome && "md:max-lg:sr-only")}>
					{app ? app.name : "seikatsu"}
					{/* The sidebar already names the app's purpose; on a phone or beside tabs the label is noise. */}
					{app && (
						<span className={cn("hidden md:inline", isKurojiHome && "md:hidden")}>
							{" "}
							· {app.label}
						</span>
					)}
				</span>
			</Link>

			{isKurojiHome && (
				<nav
					ref={navRef}
					aria-label="Kuroji sections"
					className="relative ml-3 hidden h-full shrink-0 items-stretch md:flex lg:ml-5"
				>
					{underline && (
						<span
							aria-hidden
							className={cn(
								"pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left rounded-full bg-primary",
								underline.moved &&
									"transition-transform duration-300 ease-in-out motion-reduce:transition-none",
							)}
							style={{ transform: `translateX(${underline.x}px) scaleX(${underline.w})` }}
						/>
					)}
					{KUROJI_TABS.map(({ value, label }) => {
						const active = displayTab === value;
						return (
							<Link
								key={value}
								href={tabHref(value)}
								prefetch
								data-tab={value}
								aria-current={active ? "page" : undefined}
								onClick={() => setPendingTab(value)}
								className={cn(
									"group relative flex items-center px-1 text-sm font-medium whitespace-nowrap outline-none transition-colors",
									active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
								)}
							>
								<span className="rounded-md px-2.5 py-1.5 transition-colors group-hover:bg-surface-2 group-focus-visible:ring-2 group-focus-visible:ring-ring">
									{label}
								</span>
							</Link>
						);
					})}
				</nav>
			)}

			{app && (
				<div className="ml-auto flex min-w-0 items-center gap-1.5">
					{isKuroji && workspaceId && baseCurrency && (
						<>
							<DateRangePicker />
							<span className="hidden md:contents">
								<AddTransactionModal
									workspaceId={workspaceId}
									baseCurrency={baseCurrency}
									shortcut
								/>
							</span>
						</>
					)}
					<ThemeToggle />
				</div>
			)}
		</header>
	);
}
