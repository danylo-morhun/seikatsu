"use client";

import { GlassTabBar } from "@/components/GlassTabBar";
import { Chart01Icon, Clock01Icon, Target02Icon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { preloadFormOptions } from "@/features/kuroji/lib/form-options-store";
import { type KurojiTab, buildTabHref } from "@/features/kuroji/lib/tabs";
export type { KurojiTab };

const TABS: { value: KurojiTab; label: string; icon: typeof Chart01Icon }[] = [
	{ value: "expense", label: "Expenses", icon: Chart01Icon },
	{ value: "accounts", label: "Accounts", icon: Wallet01Icon },
	{ value: "transactions", label: "Transactions", icon: Clock01Icon },
	{ value: "plan", label: "Plan", icon: Target02Icon },
];

interface Props {
	workspaceId: string;
}

export function KurojiNavTabs({ workspaceId }: Props) {
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

	const lit = isSettings ? -1 : TABS.findIndex((t) => t.value === displayTab);

	return (
		// Settings stay a key (,) and a sidebar link away; the plan is checked every week.
		<GlassTabBar
			label="Kuroji sections"
			active={lit}
			items={TABS.map(({ value, label, icon }) => ({
				label,
				icon,
				href: buildTabHref(value, searchParams.toString()),
				onClick: () => setPendingTab(value),
			}))}
		/>
	);
}
