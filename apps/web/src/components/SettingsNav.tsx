"use client";

import { APPS_CONFIG } from "@/lib/app-themes";
import { cn } from "@seikatsu/ui";
import { CoinsYenIcon, KanbanIcon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const APP_ICONS: Record<string, typeof CoinsYenIcon> = {
	"/kuroji": CoinsYenIcon,
	"/seiryu": KanbanIcon,
};

const ACCOUNT_LINKS = [{ href: "/settings/account", label: "Account", icon: UserCircleIcon }];

export function SettingsNav() {
	const pathname = usePathname();

	const appLinks = Object.entries(APPS_CONFIG).map(([appHref, { name }]) => ({
		href: `/settings${appHref}`,
		label: name,
		icon: APP_ICONS[appHref],
	}));

	const allLinks = [...ACCOUNT_LINKS, ...appLinks];

	return (
		<>
			{/* Mobile: horizontal scrollable tabs */}
			<nav className="sm:hidden flex gap-1 overflow-x-auto border-b border-border px-4 py-2 shrink-0">
				{allLinks.map(({ href, label, icon }) => (
					<Link
						key={href}
						href={href}
						className={cn(
							"flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
							pathname === href
								? "bg-accent text-foreground font-medium"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{icon && <HugeiconsIcon icon={icon} className="h-3.5 w-3.5 shrink-0" />}
						{label}
					</Link>
				))}
			</nav>

			{/* Desktop: left sidebar */}
			<nav className="hidden sm:block w-48 shrink-0 border-r border-border px-3 py-6">
				<p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Account
				</p>
				<ul className="mb-4 space-y-0.5">
					{ACCOUNT_LINKS.map(({ href, label, icon }) => (
						<li key={href}>
							<Link
								href={href}
								className={cn(
									"flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
									pathname === href
										? "bg-accent text-foreground font-medium"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
								)}
							>
								<HugeiconsIcon icon={icon} className="h-4 w-4 shrink-0" />
								{label}
							</Link>
						</li>
					))}
				</ul>

				<p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Apps
				</p>
				<ul className="space-y-0.5">
					{appLinks.map(({ href, label, icon }) => (
						<li key={href}>
							<Link
								href={href}
								className={cn(
									"flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
									pathname === href
										? "bg-accent text-foreground font-medium"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
								)}
							>
								{icon && <HugeiconsIcon icon={icon} className="h-4 w-4 shrink-0" />}
								{label}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</>
	);
}
