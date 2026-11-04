"use client";

import {
	ArrowDown01Icon,
	ArrowLeft01Icon,
	DashboardSquare01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { shellOrigin } from "@/components/ShellNav";
import { readAppEntry } from "@/lib/app-entry";
import { APPS_CONFIG } from "@/lib/app-themes";

type AppHref = keyof typeof APPS_CONFIG;

/**
 * Inside an app: its seal and name open the other apps (each at the page last visited there),
 * and Apps. The shell's way between apps, now that the sidebar lists only the shell's places.
 */
export function AppSwitcher({
	current,
	hiddenApps,
	showPurpose,
	className,
}: {
	current: AppHref;
	hiddenApps: string[];
	showPurpose: boolean;
	className?: string;
}) {
	const app = APPS_CONFIG[current];
	const [entries, setEntries] = useState<Record<string, string>>({});
	const listed = (Object.keys(APPS_CONFIG) as AppHref[]).filter(
		(href) => href === current || !hiddenApps.includes(href),
	);
	return (
		<DropdownMenu
			onOpenChange={(open) => {
				if (!open) return;
				const next: Record<string, string> = {};
				for (const href of listed) {
					const entry = readAppEntry(href);
					if (entry) next[href] = entry;
				}
				setEntries(next);
			}}
		>
			<DropdownMenuTrigger
				className={cn(
					"flex min-w-0 items-center gap-1.5 rounded-button px-1.5 py-1 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
					className,
				)}
				aria-label={`${app.name}: switch app`}
			>
				<span className="text-primary">{app.kanji}</span>
				<span className="truncate">
					{app.name}
					{showPurpose && <span className="hidden md:inline"> · {app.label}</span>}
				</span>
				<HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 shrink-0 opacity-60" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-60">
				{listed.map((href) => {
					const other = APPS_CONFIG[href];
					return (
						<DropdownMenuItem key={href} asChild className={other.theme}>
							<Link
								href={entries[href] ?? href}
								prefetch
								aria-current={href === current ? "page" : undefined}
							>
								<span
									aria-hidden
									className={cn(
										"flex size-6 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold",
										href === current
											? "bg-primary text-primary-foreground"
											: "bg-primary/10 text-primary",
									)}
								>
									{other.kanji}
								</span>
								<span className="flex min-w-0 flex-col leading-tight">
									<span className="truncate">{other.name}</span>
									<span className="truncate text-xs text-muted-foreground">{other.label}</span>
								</span>
							</Link>
						</DropdownMenuItem>
					);
				})}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/apps" prefetch>
						<HugeiconsIcon icon={DashboardSquare01Icon} className="size-4" />
						All apps
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Phones, inside an app or settings: back to the shell page the user came from. */
export function BackToShell({ className }: { className?: string }) {
	const router = useRouter();
	const [origin, setOrigin] = useState("/");
	useEffect(() => setOrigin(shellOrigin()), []);
	const label = origin.startsWith("/week")
		? "Week"
		: origin.startsWith("/goals")
			? "Goals"
			: origin.startsWith("/apps")
				? "Apps"
				: "Today";
	return (
		<Button
			variant="ghost"
			size="icon"
			className={cn("size-10", className)}
			aria-label={`Back to ${label}`}
			onClick={() => {
				startNavigationProgress();
				router.push(origin);
			}}
		>
			<HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
		</Button>
	);
}
