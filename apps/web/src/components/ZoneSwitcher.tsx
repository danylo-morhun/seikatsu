"use client";

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import Link from "next/link";
import { readAppEntry } from "@/lib/app-entry";
import { APPS_CONFIG } from "@/lib/app-themes";
import type { Zone } from "@/lib/zones";

interface Props {
	zone: Zone;
	/** The app open now, ticked in the list. */
	current: string;
	hiddenApps: string[];
	className?: string;
}

/** Beside the app's name in the header: its zone's page and the zone's other apps, one click
 * away — moving between Kuroji and Hoshii needs no trip to the sidebar. */
export function ZoneSwitcher({ zone, current, hiddenApps, className }: Props) {
	const apps = (zone.apps as readonly (keyof typeof APPS_CONFIG)[]).filter(
		(href) => href === current || !hiddenApps.includes(href),
	);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={`${zone.name}: switch app`}
				className={cn(
					"flex size-7 shrink-0 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground data-[state=open]:bg-surface-2 data-[state=open]:text-foreground",
					className,
				)}
			>
				<HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-52">
				<DropdownMenuItem asChild>
					<Link href={zone.href} prefetch>
						<span aria-hidden className="w-4 text-center text-muted-foreground">
							{zone.kanji}
						</span>
						{zone.name}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				{apps.map((href) => {
					const app = APPS_CONFIG[href];
					return (
						<DropdownMenuItem key={href} asChild>
							<Link href={readAppEntry(href) ?? href} prefetch>
								<span aria-hidden className={cn(app.theme, "w-4 text-center text-primary")}>
									{app.kanji}
								</span>
								<span className="flex-1">{app.name}</span>
								<span className="text-xs text-muted-foreground">{app.label}</span>
								{href === current && (
									<HugeiconsIcon icon={Tick02Icon} className="size-4 text-foreground" />
								)}
							</Link>
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
