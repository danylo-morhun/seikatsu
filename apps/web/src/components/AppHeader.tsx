"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { DateRangePicker } from "@/features/kuroji/components/DateRangePicker";
import { type KurojiTab, buildTabHref } from "@/features/kuroji/lib/tabs";
import { getAppForPath } from "@/lib/app-themes";
import { Chart01Icon, Clock01Icon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarTrigger, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const KUROJI_TABS: { value: KurojiTab; label: string; icon: typeof Chart01Icon }[] = [
	{ value: "expense", label: "Expenses", icon: Chart01Icon },
	{ value: "accounts", label: "Accounts", icon: Wallet01Icon },
	{ value: "transactions", label: "Transactions", icon: Clock01Icon },
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

	function tabHref(tab: KurojiTab) {
		return buildTabHref(tab, searchParams.toString());
	}

	return (
		<header className="relative flex h-14 shrink-0 items-center gap-1 border-b border-border px-2">
			<SidebarTrigger className="h-7 w-7 [&>svg]:h-4 [&>svg]:w-4" />
			<div aria-hidden className="h-4 w-px shrink-0 bg-border" />

			<Link
				href={app?.href ?? "/"}
				className="ml-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
			>
				{app?.name ?? "seikatsu"}
			</Link>

			{isKurojiHome && (
				<nav className="absolute left-1/2 hidden -translate-x-1/2 md:flex h-full items-stretch">
					{KUROJI_TABS.map(({ value, label, icon }) => (
						<Link
							key={value}
							href={tabHref(value)}
							className={cn(
								"relative flex items-center gap-1.5 px-3.5 text-sm font-medium transition-colors",
								activeTab === value
									? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<HugeiconsIcon icon={icon} className="h-4 w-4" />
							{label}
						</Link>
					))}
				</nav>
			)}

			{app && (
				<div className="ml-auto flex items-center gap-1.5">
					{isKuroji && workspaceId && baseCurrency && (
						<>
							<DateRangePicker />
							<span className="hidden md:contents">
								<AddTransactionModal workspaceId={workspaceId} baseCurrency={baseCurrency} />
							</span>
						</>
					)}
					<ThemeToggle />
				</div>
			)}
		</header>
	);
}
