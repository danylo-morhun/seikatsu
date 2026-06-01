"use client";

import { PageLoader } from "@/components/PageLoader";
import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { Button, cn } from "@seikatsu/ui";
import {
	Add01Icon,
	Chart01Icon,
	Clock01Icon,
	Settings01Icon,
	Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export type MidasTab = "overview" | "accounts" | "transactions";

const TABS: { value: MidasTab; label: string; icon: typeof Chart01Icon }[] = [
	{ value: "overview", label: "Expenses", icon: Chart01Icon },
	{ value: "accounts", label: "Accounts", icon: Wallet01Icon },
	{ value: "transactions", label: "History", icon: Clock01Icon },
];

interface Props {
	workspaceId: string;
	baseCurrency: string;
}

export function MidasNavTabs({ workspaceId, baseCurrency }: Props) {
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [pendingTab, setPendingTab] = useState<MidasTab | null>(null);

	const activeTab = (searchParams.get("tab") as MidasTab) || "overview";
	const displayTab = pendingTab ?? activeTab;
	const isSettings = pathname.startsWith("/settings");

	useEffect(() => {
		if (!isPending) setPendingTab(null);
	}, [isPending]);

	function tabHref(tab: MidasTab) {
		const params = new URLSearchParams(searchParams.toString());
		if (tab === "overview") {
			params.delete("tab");
		} else {
			params.set("tab", tab);
		}
		if (tab !== "transactions") {
			params.delete("page");
			params.delete("account");
			params.delete("q");
			params.delete("sort");
			params.delete("dir");
			params.delete("tag");
		}
		const qs = params.toString();
		return qs ? `/kuroji?${qs}` : "/kuroji";
	}

	function handleTabClick(tab: MidasTab) {
		if (tab === displayTab && !isSettings) return;
		setPendingTab(tab);
		startTransition(() => {
			router.push(tabHref(tab));
		});
	}

	function tabCls(active: boolean, loading = false) {
		return cn(
			"flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all duration-200",
			active ? "text-primary" : "text-muted-foreground",
			loading && "opacity-50",
		);
	}

	return (
		<>
			{isPending && <PageLoader overlay />}
			<nav
				className="fixed inset-x-0 bottom-0 z-40 md:hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			>
				<div className="mx-3 mb-3">
					<div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/85 px-2 py-1.5 shadow-lg backdrop-blur-xl">
						{/* Left: Expenses, Accounts */}
						<div className="flex flex-1 items-center justify-around">
							{TABS.slice(0, 2).map(({ value, label, icon }) => (
								<button
									key={value}
									type="button"
									onClick={() => handleTabClick(value)}
									className={tabCls(
										displayTab === value && !isSettings,
										isPending && pendingTab === value,
									)}
								>
									<HugeiconsIcon icon={icon} className="h-5 w-5" />
									<span className="text-[10px] font-medium leading-none">{label}</span>
								</button>
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
							<button
								type="button"
								onClick={() => handleTabClick("transactions")}
								className={tabCls(
									displayTab === "transactions" && !isSettings,
									isPending && pendingTab === "transactions",
								)}
							>
								<HugeiconsIcon icon={Clock01Icon} className="h-5 w-5" />
								<span className="text-[10px] font-medium leading-none">History</span>
							</button>
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
