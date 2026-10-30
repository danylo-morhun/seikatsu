"use client";

import { ShortcutsButton } from "@/components/KeyboardShortcuts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requestLogService } from "@/features/aisha/lib/events";
import { requestAdd } from "@/features/hoshii/lib/events";
import { requestNewHabit } from "@/features/keizoku/lib/events";
import { type KurojiTab, buildTabHref } from "@/features/kuroji/lib/tabs";
import { requestNewApplication } from "@/features/kyuu/lib/events";
import { CARRY_PARAMS } from "@/features/kyuu/lib/search-params";
import { OfflinePill } from "@/features/pwa/components/OfflinePill";
import { requestNewCard } from "@/features/seiryu/lib/events";
import { requestNewBook } from "@/features/tsundoku/lib/events";
import { getAppForPath } from "@/lib/app-themes";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, SidebarTrigger, cn } from "@seikatsu/ui";
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
	"md:rounded-full xl:w-auto xl:gap-2 xl:px-3 max-md:bg-transparent max-md:text-primary max-md:shadow-none max-md:hover:bg-surface-2 max-md:active:bg-surface-2 max-md:[&_svg]:size-5 max-md:[&_svg]:stroke-[2]";

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

	// The page has scrolled under the header (it only sticks with a mouse; see below).
	const [scrolled, setScrolled] = useState(false);
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 4);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		setPendingTab(null);
	}, [activeTab, pathname]);

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
	// The segmented control's lens: measured from the lit segment so it hugs its label.
	const navRef = useRef<HTMLElement>(null);
	const [lens, setLens] = useState<{ x: number; w: number; moved: boolean } | null>(null);
	useLayoutEffect(() => {
		const nav = navRef.current;
		function place() {
			const lit = nav?.querySelector<HTMLElement>(`[data-tab="${displayTab}"]`);
			if (!lit) return setLens(null);
			setLens((prev) => ({ x: lit.offsetLeft, w: lit.offsetWidth, moved: prev !== null }));
		}
		place();
		window.addEventListener("resize", place);
		return () => window.removeEventListener("resize", place);
	}, [displayTab]);

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
		// Solid fill: iOS 26 tints the status bar from it; no hairline on phones, as in iOS 26.
		// Not sticky on touch — in the Home Screen app a sticky header under the status bar
		// swallowed every tap on the page below it. With a mouse it sticks and turns to glass once
		// the page scrolls under it, like a macOS toolbar.
		<header
			data-scrolled={scrolled || undefined}
			className="box-content flex h-14 shrink-0 items-center gap-1 bg-background px-2 pt-[env(safe-area-inset-top)] md:top-0 md:z-30 md:transition-[background-color,box-shadow] md:duration-200 md:pointer-fine:sticky md:data-scrolled:bg-background/70 md:data-scrolled:shadow-[0_1px_0_var(--rule)] md:data-scrolled:backdrop-blur-xl md:data-scrolled:backdrop-saturate-150"
		>
			<div className="flex min-w-0 items-center gap-3">
				<SidebarTrigger className="glass size-10 rounded-full md:size-9 [&>svg]:h-4 [&>svg]:w-4" />
				<Link
					href={app?.href ?? (isSettings ? "/settings" : "/")}
					className={cn(
						"flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
						tabs.length > 0 && "md:max-lg:hidden",
					)}
				>
					{app && <span className="text-primary">{app.kanji}</span>}
					<span className="truncate">
						{app ? app.name : isSettings ? "Settings" : "seikatsu"}
						{/* The sidebar already names the app's purpose; on a phone or beside tabs the label is noise. */}
						{app && showPurpose && <span className="hidden md:inline"> · {app.label}</span>}
					</span>
				</Link>
			</div>

			{tabs.length > 0 && (
				// macOS segmented control: a glass capsule whose lens slides to the open section.
				<nav
					ref={navRef}
					aria-label={`${app?.name ?? ""} sections`}
					className="glass relative ml-1 hidden h-9 shrink-0 rounded-full p-0.5 md:flex lg:ml-3"
				>
					{lens && (
						<span
							aria-hidden
							className={cn(
								"absolute inset-y-0.5 left-0 rounded-full bg-(--glass-lens)",
								lens.moved &&
									"transition-[transform,width] duration-300 ease-drawer motion-reduce:transition-none",
							)}
							style={{ width: lens.w, transform: `translateX(${lens.x}px)` }}
						/>
					)}
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
									"relative flex items-center justify-center rounded-full px-3 text-sm font-medium whitespace-nowrap lg:px-4 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
									active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
								)}
							>
								{label}
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
										<span className="hidden xl:inline">New Transaction</span>
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
								<span className="hidden xl:inline">New Card</span>
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
								<span className="hidden xl:inline">Add Book</span>
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
								<span className="hidden xl:inline">New Habit</span>
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
								<span className="hidden xl:inline">New Application</span>
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
								<span className="hidden xl:inline">Log Service</span>
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
								<span className="hidden xl:inline">Add a Want</span>
							</Button>
						)}
						{/* Wide screens: the quiet buttons share a capsule; capture stands beside it. */}
						<div className="max-md:contents md:glass md:flex md:items-center md:rounded-full md:p-0.5 md:[&_button]:rounded-full">
							<ShortcutsButton />
							<ThemeToggle />
						</div>
					</div>
				</div>
			)}
		</header>
	);
}
