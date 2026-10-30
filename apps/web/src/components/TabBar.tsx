"use client";

import { useDesign } from "@/components/DesignProvider";
import type { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

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
	/** The app's capture (a `TabBarAction`). Classic puts it in the middle of the bar; Liquid
	 * Glass keeps the bar to tabs and captures from the header instead. */
	action?: ReactNode;
}

/** Phones: the app's bottom navigation, in the current look. */
export function TabBar(props: Props) {
	return useDesign().design === "glass" ? <GlassBar {...props} /> : <ClassicBar {...props} />;
}

/**
 * iOS-style liquid glass tab bar: a floating glass capsule of tabs with a lens that slides to
 * the lit one.
 */
function GlassBar({ label, items, active }: Props) {
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
					{items.map((item, i) => (
						<Tab
							key={item.label}
							item={item}
							lit={i === active}
							className="flex-1 gap-0.5 rounded-full transition-[color,transform] duration-150 ease-out active:scale-[0.96]"
							litClass="text-primary"
							restClass="text-foreground/80"
						>
							<HugeiconsIcon icon={item.icon} className="h-[22px] w-[22px]" />
							<span className="max-w-full truncate px-1 text-[10px] leading-tight font-semibold">
								{item.label}
							</span>
						</Tab>
					))}
				</div>
			</div>
		</nav>
	);
}

/** The flat pill: tabs either side of the capture, one chip sliding to the lit tab. */
function ClassicBar({ label, items, active, action }: Props) {
	// The capture takes the middle column; tabs after it shift one column right.
	const middle = Math.floor(items.length / 2);
	const columns = items.length + (action ? 1 : 0);
	const litColumn = active < 0 ? -1 : action && active >= middle ? active + 1 : active;
	const tab = (item: TabBarItem, i: number) => (
		<Tab
			key={item.label}
			item={item}
			lit={i === active}
			className="min-h-11 gap-1 rounded-xl transition-colors duration-150"
			litClass="text-primary"
			restClass="text-muted-foreground active:text-foreground"
		>
			<span className="flex h-7 w-12 items-center justify-center">
				<HugeiconsIcon icon={item.icon} className="h-5 w-5" />
			</span>
			<span className="max-w-full truncate px-0.5 text-[11px] leading-none font-medium">
				{item.label}
			</span>
		</Tab>
	);
	return (
		<nav
			aria-label={label}
			className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
		>
			<div
				className={cn(
					"relative mx-3 mb-3 grid items-center rounded-2xl border border-rule bg-sidebar px-1 py-1.5",
					columns === 5 ? "grid-cols-5" : columns === 4 ? "grid-cols-4" : "grid-cols-3",
				)}
			>
				{/* One pill slides to the lit item, so the move reads as going somewhere. */}
				{litColumn >= 0 && (
					<span
						aria-hidden
						className="pointer-events-none absolute top-1.5 left-1 flex justify-center transition-transform duration-300 ease-in-out motion-reduce:transition-none"
						style={{
							width: `calc((100% - 0.5rem) / ${columns})`,
							transform: `translateX(${litColumn * 100}%)`,
						}}
					>
						<span className="h-7 w-12 rounded-full bg-primary/15" />
					</span>
				)}
				{items.slice(0, action ? middle : items.length).map(tab)}
				{action && <div className="relative flex items-center justify-center">{action}</div>}
				{action && items.slice(middle).map((item, i) => tab(item, i + middle))}
			</div>
		</nav>
	);
}

function Tab({
	item,
	lit,
	className,
	litClass,
	restClass,
	children,
}: {
	item: TabBarItem;
	lit: boolean;
	className: string;
	litClass: string;
	restClass: string;
	children: ReactNode;
}) {
	const classes = cn(
		"relative flex min-w-0 flex-col items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring",
		className,
		lit ? litClass : restClass,
	);
	return item.href ? (
		<Link
			href={item.href}
			prefetch
			aria-current={lit ? "page" : undefined}
			onClick={item.onClick}
			className={classes}
		>
			{children}
		</Link>
	) : (
		<button
			type="button"
			aria-haspopup={item["aria-haspopup"]}
			aria-pressed={lit}
			onClick={item.onClick}
			className={classes}
		>
			{children}
		</button>
	);
}

/** The capture button in the middle of the Classic bar. Works as a Radix trigger. */
export function TabBarAction({
	icon,
	className,
	...props
}: ComponentProps<typeof Button> & { icon: Icon }) {
	return (
		<Button size="icon" className={cn("h-11 w-11 rounded-full", className)} {...props}>
			<HugeiconsIcon icon={icon} className="h-5 w-5" />
		</Button>
	);
}
