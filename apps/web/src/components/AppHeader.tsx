"use client";

import { ShortcutsButton } from "@/components/KeyboardShortcuts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TravelUnderline } from "@/components/TravelUnderline";
import { requestLogService } from "@/features/aisha/lib/events";
import { requestAdd } from "@/features/hoshii/lib/events";
import { requestNewHabit } from "@/features/keizoku/lib/events";
import { type KurojiTab, buildTabHref } from "@/features/kuroji/lib/tabs";
import { requestNewApplication } from "@/features/kyuu/lib/events";
import { CARRY_PARAMS } from "@/features/kyuu/lib/search-params";
import { OfflinePill } from "@/features/pwa/components/OfflinePill";
import { requestNewCard } from "@/features/seiryu/lib/events";
import { requestNewBook } from "@/features/tsundoku/lib/events";
import { useIndicator } from "@/hooks/useIndicator";
import { getAppForPath } from "@/lib/app-themes";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, SidebarTrigger, cn } from "@seikatsu/ui";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

const TSUNDOKU_TABS = [
	{ value: "/tsundoku", label: "Library" },
	{ value: "/tsundoku/year", label: "Year" },
] as const;

const KEIZOKU_TABS = [
	{ value: "/keizoku", label: "Today" },
	{ value: "/keizoku/year", label: "Year" },
	{ value: "/keizoku/archive", label: "Archive" },
] as const;

const KYUU_TABS = [
	{ value: "/kyuu", label: "Applications" },
	{ value: "/kyuu/stats", label: "Stats" },
] as const;

const AISHA_TABS = [
	{ value: "/aisha", label: "Next" },
	{ value: "/aisha/history", label: "History" },
	{ value: "/aisha/year", label: "Year" },
] as const;

const HOSHII_TABS = [
	{ value: "/hoshii", label: "Now" },
	{ value: "/hoshii/lists", label: "Lists" },
	{ value: "/hoshii/summary", label: "Summary" },
] as const;

const KUROJI_TABS: { value: KurojiTab; label: string }[] = [
	{ value: "expense", label: "Expenses" },
	{ value: "accounts", label: "Accounts" },
	{ value: "transactions", label: "Transactions" },
	{ value: "plan", label: "Plan" },
];

// The app's capture: a labelled button on wide screens; on phones an accent glyph in the
// header's glass capsule, like iOS Mail's compose — the tab bar below holds only tabs.
const CAPTURE =
	"lg:w-auto lg:gap-2 lg:px-3 max-md:bg-transparent max-md:text-primary max-md:shadow-none max-md:hover:bg-surface-2 max-md:active:bg-surface-2 max-md:[&_svg]:size-5 max-md:[&_svg]:stroke-[2]";

interface Props {
	workspaceId?: string;
	baseCurrency?: string;
}

export function AppHeader({ workspaceId, baseCurrency }: Props) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const app = getAppForPath(pathname);

	const isSettings = pathname.startsWith("/settings");
	const isKurojiHome = pathname === "/kuroji";
	const isKuroji = pathname.startsWith("/kuroji");
	// A Seiryu board (not a card page): its capture action sits where Kuroji's does.
	const isSeiryuBoard = /^\/seiryu\/[^/]+$/.test(pathname);
	// Tsundoku's library and year carry their tabs, and capture, like Kuroji's overview.
	const isTsundokuHome = TSUNDOKU_TABS.some((t) => t.value === pathname);
	const isTsundoku = pathname === "/tsundoku" || pathname.startsWith("/tsundoku/");
	// Keizoku's three pages carry their tabs; New Habit sits in the header on every Keizoku page.
	const isKeizokuHome = KEIZOKU_TABS.some((t) => t.value === pathname);
	const isKeizoku = pathname === "/keizoku" || pathname.startsWith("/keizoku/");
	// Kyuu's table and stats carry their tabs; New Application sits on every Kyuu page.
	const isKyuuHome = KYUU_TABS.some((t) => t.value === pathname);
	const isKyuu = pathname === "/kyuu" || pathname.startsWith("/kyuu/");
	// Aisha's three pages carry their tabs; Log Service sits on every Aisha page.
	const isAishaHome = AISHA_TABS.some((t) => t.value === pathname);
	const isAisha = pathname === "/aisha" || pathname.startsWith("/aisha/");
	// Hoshii's three pages carry their tabs; Add a Want sits on every Hoshii page.
	const isHoshiiHome = HOSHII_TABS.some((t) => t.value === pathname);
	const isHoshii = pathname === "/hoshii" || pathname.startsWith("/hoshii/");
	const isSectionHome =
		isTsundokuHome || isKeizokuHome || isKyuuHome || isAishaHome || isHoshiiHome;
	// Seiryu's project list names what's open; "· Projects" beside it says nothing new.
	const showPurpose = !isKurojiHome && !isSectionHome && !pathname.startsWith("/seiryu");
	const activeTab = isSectionHome ? pathname : (searchParams.get("tab") as KurojiTab) || "expense";
	// Highlight the clicked tab immediately; the URL catches up when navigation commits.
	const [pendingTab, setPendingTab] = useState<string | null>(null);
	const displayTab = pendingTab ?? activeTab;

	useEffect(() => {
		setPendingTab(null);
	}, [activeTab, pathname]);

	// One underline that travels between tabs, so the eye follows where you went.
	const navRef = useRef<HTMLElement>(null);
	const underline = useIndicator(
		navRef,
		`[data-tab="${displayTab}"] > span`,
		`${pathname}:${displayTab}`,
	);

	const tabs = isKurojiHome
		? KUROJI_TABS.map(({ value, label }) => ({
				value,
				label,
				href: buildTabHref(value, searchParams.toString()),
			}))
		: isTsundokuHome
			? TSUNDOKU_TABS.map(({ value, label }) => ({ value, label, href: value }))
			: isKeizokuHome
				? KEIZOKU_TABS.map(({ value, label }) => ({ value, label, href: value }))
				: isKyuuHome
					? KYUU_TABS.map(({ value, label }) => ({ value, label, href: kyuuTabHref(value) }))
					: isAishaHome
						? AISHA_TABS.map(({ value, label }) => ({ value, label, href: value }))
						: isHoshiiHome
							? HOSHII_TABS.map(({ value, label }) => ({ value, label, href: value }))
							: [];

	// The table and Stats share their filters.
	function kyuuTabHref(href: string) {
		const params = new URLSearchParams();
		for (const key of CARRY_PARAMS) {
			const value = searchParams.get(key);
			if (value) params.set(key, value);
		}
		const qs = params.toString();
		return qs ? `${href}?${qs}` : href;
	}

	return (
		// Solid fill: iOS 26 tints the status bar from it. Not sticky — in the Home Screen app a
		// sticky header under the status bar swallowed every tap on the page below it.
		<header className="box-content flex h-14 shrink-0 items-center gap-1 border-b border-border bg-background px-2 pt-[env(safe-area-inset-top)]">
			<SidebarTrigger className="size-10 max-md:-ml-2 md:size-8 [&>svg]:h-4 [&>svg]:w-4" />
			<div aria-hidden className="h-4 w-px shrink-0 bg-border" />

			<Link
				href={app?.href ?? (isSettings ? "/settings" : "/")}
				className="ml-2 flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				{app && <span className="text-primary">{app.kanji}</span>}
				<span className={cn("truncate", tabs.length > 0 && "md:max-lg:sr-only")}>
					{app ? app.name : isSettings ? "Settings" : "seikatsu"}
					{/* The sidebar already names the app's purpose; on a phone or beside tabs the label is noise. */}
					{app && showPurpose && <span className="hidden md:inline"> · {app.label}</span>}
				</span>
			</Link>

			{tabs.length > 0 && (
				<nav
					ref={navRef}
					aria-label={`${app?.name ?? ""} sections`}
					className="relative ml-3 hidden h-full shrink-0 items-stretch md:flex lg:ml-5"
				>
					<TravelUnderline indicator={underline} />
					{tabs.map(({ value, label, href }) => {
						const active = displayTab === value;
						return (
							<Link
								key={value}
								href={href}
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

			{(app || pathname === "/") && (
				<div className="ml-auto flex min-w-0 items-center gap-1.5">
					<OfflinePill />
					{/* The plan picks its own month. */}
					{isKuroji && workspaceId && baseCurrency && !(isKurojiHome && activeTab === "plan") && (
						<DateRangePicker />
					)}
					{/* Phones: capture and theme share one glass capsule, like iOS 26 bar buttons. */}
					<div className="flex items-center max-md:glass max-md:rounded-full max-md:p-0.5 max-md:[&_button]:size-9 max-md:[&_button]:rounded-full md:contents">
						{isKuroji && workspaceId && baseCurrency && (
							<AddTransactionModal
								workspaceId={workspaceId}
								baseCurrency={baseCurrency}
								shortcut
								trigger={
									<Button size="icon" className={CAPTURE} aria-label="New transaction">
										<HugeiconsIcon icon={Add01Icon} className="h-4 w-4 shrink-0" />
										<span className="hidden lg:inline">New Transaction</span>
									</Button>
								}
							/>
						)}
						{isSeiryuBoard && (
							<Button
								size="icon"
								className={CAPTURE}
								aria-label="New card"
								onClick={requestNewCard}
							>
								<HugeiconsIcon icon={Add01Icon} className="h-4 w-4 shrink-0" />
								<span className="hidden lg:inline">New Card</span>
							</Button>
						)}
						{isTsundoku && (
							<Button
								size="icon"
								className={CAPTURE}
								aria-label="Add book"
								aria-keyshortcuts="N"
								onClick={requestNewBook}
							>
								<HugeiconsIcon icon={Add01Icon} className="h-4 w-4 shrink-0" />
								<span className="hidden lg:inline">Add Book</span>
							</Button>
						)}
						{isKeizoku && (
							<Button
								size="icon"
								className={CAPTURE}
								aria-label="New habit"
								aria-keyshortcuts="N"
								onClick={requestNewHabit}
							>
								<HugeiconsIcon icon={Add01Icon} className="h-4 w-4 shrink-0" />
								<span className="hidden lg:inline">New Habit</span>
							</Button>
						)}
						{isKyuu && (
							<Button
								size="icon"
								className={CAPTURE}
								aria-label="New application"
								aria-keyshortcuts="N"
								onClick={requestNewApplication}
							>
								<HugeiconsIcon icon={Add01Icon} className="h-4 w-4 shrink-0" />
								<span className="hidden lg:inline">New Application</span>
							</Button>
						)}
						{isAisha && (
							<Button
								size="icon"
								className={CAPTURE}
								aria-label="Log service"
								aria-keyshortcuts="N"
								onClick={() => requestLogService()}
							>
								<HugeiconsIcon icon={Add01Icon} className="h-4 w-4 shrink-0" />
								<span className="hidden lg:inline">Log Service</span>
							</Button>
						)}
						{isHoshii && (
							<Button
								size="icon"
								className={CAPTURE}
								aria-label="Add a want"
								aria-keyshortcuts="N"
								onClick={() => requestAdd()}
							>
								<HugeiconsIcon icon={Add01Icon} className="h-4 w-4 shrink-0" />
								<span className="hidden lg:inline">Add a Want</span>
							</Button>
						)}
						<ShortcutsButton />
						<ThemeToggle />
					</div>
				</div>
			)}
		</header>
	);
}
