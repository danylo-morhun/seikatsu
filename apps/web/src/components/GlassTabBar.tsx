"use client";

import type { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";

type Icon = typeof Add01Icon;

export interface TabBarItem {
	label: string;
	icon: Icon;
	/** A link tab; without it the tab is a button (e.g. opens a sheet). */
	href?: string;
	onClick?: () => void;
	"aria-haspopup"?: "dialog";
}

interface Props {
	label: string;
	/** Four tabs at most. */
	items: TabBarItem[];
	/** Index of the lit tab; -1 lights nothing. */
	active: number;
}

/**
 * Phones: iOS-style liquid glass tab bar — a floating glass capsule of tabs with a lens that
 * slides to the lit one. Capture lives in the header (`AppHeader`), as in iOS Mail.
 */
export function GlassTabBar({ label, items, active }: Props) {
	return (
		<nav aria-label={label} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden">
			{/* Scroll edge: content softens under the bar instead of colliding with it. */}
			<div
				aria-hidden
				className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-background/70 to-transparent"
			/>
			<div className="relative flex px-4 pb-[max(calc(env(safe-area-inset-bottom)-0.5rem),0.75rem)]">
				<div className="glass pointer-events-auto relative flex h-[60px] min-w-0 flex-1 rounded-full p-1">
					{active >= 0 && (
						<span
							aria-hidden
							className="absolute inset-y-1 left-1 rounded-full bg-(--glass-lens) transition-transform duration-300 ease-drawer motion-reduce:transition-none"
							style={{
								width: `calc((100% - 0.5rem) / ${items.length})`,
								transform: `translateX(${active * 100}%)`,
							}}
						/>
					)}
					{items.map((item, i) => {
						const lit = i === active;
						const className = cn(
							"relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full outline-none transition-[color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]",
							lit ? "text-primary" : "text-foreground/80",
						);
						return item.href ? (
							<Link
								key={item.label}
								href={item.href}
								prefetch
								aria-current={lit ? "page" : undefined}
								onClick={item.onClick}
								className={className}
							>
								<TabLabel icon={item.icon} label={item.label} />
							</Link>
						) : (
							<button
								key={item.label}
								type="button"
								aria-haspopup={item["aria-haspopup"]}
								aria-pressed={lit}
								onClick={item.onClick}
								className={className}
							>
								<TabLabel icon={item.icon} label={item.label} />
							</button>
						);
					})}
				</div>
			</div>
		</nav>
	);
}

function TabLabel({ icon, label }: { icon: Icon; label: string }) {
	return (
		<>
			<HugeiconsIcon icon={icon} className="h-[22px] w-[22px]" />
			<span className="max-w-full truncate px-1 text-[10px] font-semibold leading-tight">
				{label}
			</span>
		</>
	);
}
