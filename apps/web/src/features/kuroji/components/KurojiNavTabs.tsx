"use client";

import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import {
	Add01Icon,
	Chart01Icon,
	Clock01Icon,
	Settings01Icon,
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
					"group flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
					active ? "text-primary" : "text-muted-foreground active:text-foreground",
				)}
			>
				<span
					className={cn(
						"flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150",
						active && "bg-primary/15",
					)}
				>
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
			<div className="mx-3 mb-3 grid grid-cols-5 items-center rounded-2xl border border-rule bg-sidebar px-1 py-1.5">
				{TABS.slice(0, 2).map(({ value, label, icon }) =>
					navItem(tabHref(value), label, icon, displayTab === value && !isSettings, value),
				)}

				<div className="flex items-center justify-center">
					<AddTransactionModal
						workspaceId={workspaceId}
						baseCurrency={baseCurrency}
						trigger={
							<Button
								size="icon"
								aria-label="New transaction"
								className="h-11 w-11 rounded-full transition-transform active:scale-95"
							>
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
				{navItem("/settings/kuroji", "Settings", Settings01Icon, isSettings)}
			</div>
		</nav>
	);
}
