"use client";

import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import {
	Add01Icon,
	Chart01Icon,
	Clock01Icon,
	Target02Icon,
	Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { preloadFormOptions } from "@/features/kuroji/lib/form-options-store";
import { type KurojiTab, buildTabHref } from "@/features/kuroji/lib/tabs";
export type { KurojiTab };

const TABS: { value: KurojiTab; label: string; icon: typeof Chart01Icon }[] = [
	{ value: "expense", label: "Expenses", icon: Chart01Icon },
	{ value: "accounts", label: "Accounts", icon: Wallet01Icon },
	{ value: "transactions", label: "Transactions", icon: Clock01Icon },
];

interface Props {
	workspaceId: string;
	baseCurrency: string;
}

export function KurojiNavTabs({ workspaceId, baseCurrency }: Props) {
	const searchParams = useSearchParams();
	const pathname = usePathname();
	// Highlight the tapped tab immediately; the URL catches up when navigation commits.
	const [pendingTab, setPendingTab] = useState<KurojiTab | null>(null);

	const activeTab = (searchParams.get("tab") as KurojiTab) || "expense";
	const displayTab = pendingTab ?? activeTab;
	const isSettings = pathname.startsWith("/settings");

	useEffect(() => {
		setPendingTab(null);
	}, [activeTab, pathname]);

	// Warm accounts/tags so the transaction form opens fully populated.
	useEffect(() => {
		preloadFormOptions(workspaceId);
	}, [workspaceId]);

	// Grid column of the lit item (the add button holds column 2); -1 lights nothing.
	const litColumn = isSettings
		? -1
		: displayTab === "transactions"
			? 3
			: displayTab === "plan"
				? 4
				: TABS.findIndex((t) => t.value === displayTab);

	function tabHref(tab: KurojiTab) {
		return buildTabHref(tab, searchParams.toString());
	}

	function navItem(
		href: string,
		label: string,
		icon: typeof Chart01Icon,
		active: boolean,
		tab?: KurojiTab,
	) {
		return (
			<Link
				key={label}
				href={href}
				prefetch
				aria-current={active ? "page" : undefined}
				onClick={tab ? () => setPendingTab(tab) : undefined}
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
	}

	return (
		<nav
			aria-label="Kuroji sections"
			className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
		>
			<div className="relative mx-3 mb-3 grid grid-cols-5 items-center rounded-2xl border border-rule bg-sidebar px-1 py-1.5">
				{/* One pill slides to the lit item, so the move reads as going somewhere. */}
				{litColumn >= 0 && (
					<span
						aria-hidden
						className="pointer-events-none absolute top-1.5 left-1 flex w-[calc((100%-0.5rem)/5)] justify-center transition-transform duration-300 ease-in-out motion-reduce:transition-none"
						style={{ transform: `translateX(${litColumn * 100}%)` }}
					>
						<span className="h-7 w-12 rounded-full bg-primary/15" />
					</span>
				)}
				{TABS.slice(0, 2).map(({ value, label, icon }) =>
					navItem(tabHref(value), label, icon, displayTab === value && !isSettings, value),
				)}

				<div className="relative flex items-center justify-center">
					<AddTransactionModal
						workspaceId={workspaceId}
						baseCurrency={baseCurrency}
						trigger={
							<Button size="icon" aria-label="New transaction" className="h-11 w-11 rounded-full">
								<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
							</Button>
						}
					/>
				</div>

				{navItem(
					tabHref("transactions"),
					"Transactions",
					Clock01Icon,
					displayTab === "transactions" && !isSettings,
					"transactions",
				)}
				{/* Settings stay a key (,) and a sidebar link away; the plan is checked every week. */}
				{navItem(
					tabHref("plan"),
					"Plan",
					Target02Icon,
					displayTab === "plan" && !isSettings,
					"plan",
				)}
			</div>
		</nav>
	);
}
