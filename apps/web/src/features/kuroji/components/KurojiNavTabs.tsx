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

	function tabHref(tab: KurojiTab) {
		return buildTabHref(tab, searchParams.toString());
	}

	function tabCls(active: boolean) {
		return cn(
			"flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors duration-150",
			active ? "text-primary" : "text-muted-foreground",
		);
	}

	return (
		<>
			<nav
				className="fixed inset-x-0 bottom-0 z-40 md:hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			>
				<div className="mx-3 mb-3">
					<div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/85 px-2 py-1.5 shadow-lg backdrop-blur-xl">
						{/* Left: Expenses, Accounts */}
						<div className="flex flex-1 items-center justify-around">
							{TABS.slice(0, 2).map(({ value, label, icon }) => (
								<Link
									key={value}
									href={tabHref(value)}
									prefetch
									onClick={() => setPendingTab(value)}
									className={tabCls(displayTab === value && !isSettings)}
								>
									<HugeiconsIcon icon={icon} className="h-5 w-5" />
									<span className="text-[10px] font-medium leading-none">{label}</span>
								</Link>
							))}
						</div>

						{/* Center: FAB */}
						<div className="flex shrink-0 items-center justify-center px-1">
							<AddTransactionModal
								workspaceId={workspaceId}
								baseCurrency={baseCurrency}
								trigger={
									<Button
										size="icon"
										className="h-11 w-11 rounded-full shadow-lg shadow-primary/25 transition-transform active:scale-95"
									>
										<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
									</Button>
								}
							/>
						</div>

						{/* Right: History, Settings */}
						<div className="flex flex-1 items-center justify-around">
							<Link
								href={tabHref("transactions")}
								prefetch
								onClick={() => setPendingTab("transactions")}
								className={tabCls(displayTab === "transactions" && !isSettings)}
							>
								<HugeiconsIcon icon={Clock01Icon} className="h-5 w-5" />
								<span className="text-[10px] font-medium leading-none">Transactions</span>
							</Link>
							<Link href="/settings" className={tabCls(isSettings)}>
								<HugeiconsIcon icon={Settings01Icon} className="h-5 w-5" />
								<span className="text-[10px] font-medium leading-none">Settings</span>
							</Link>
						</div>
					</div>
				</div>
			</nav>
		</>
	);
}
