import { APPS_CONFIG } from "@/lib/app-themes";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties } from "react";

export type AppHref = keyof typeof APPS_CONFIG;

interface FrameProps {
	href: AppHref;
	index: number;
	/** Carries a list: the full row on a phone, half of it on a desktop. */
	wide?: boolean;
	/** The odd one out among the small tiles: takes two columns so the row has no hole. */
	fill?: boolean;
	/** Leaves room beside the name for the tile's corner action. */
	action?: boolean;
	children: React.ReactNode;
}

/** One app at a glance: its seal and name as the sidebar has them, then its body (TileBody),
 * which streams in on its own. The tile opens the app. */
export function TileFrame({
	href,
	index,
	wide = false,
	fill = false,
	action,
	children,
}: FrameProps) {
	const app = APPS_CONFIG[href];
	return (
		<section
			className={cn(
				app.theme,
				"relative flex min-w-0 animate-rise flex-col rounded-xl bg-surface p-4 transition-colors duration-150 has-[>div>a:hover]:bg-surface-2/60",
				// A list sets its own height; its neighbour keeps its own.
				wide && "col-span-2 lg:self-start",
				fill && "col-span-2",
			)}
			style={{ "--i": index } as CSSProperties}
		>
			<div className={cn("flex items-center gap-2", action && "sm:pr-16")}>
				<Link
					href={href}
					prefetch
					className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
				>
					<span aria-hidden className="font-semibold text-primary">
						{app.kanji}
					</span>
					<span className="truncate">{app.label}</span>
				</Link>
			</div>
			{children}
		</section>
	);
}

interface BodyProps {
	value: string | null;
	note?: string | null;
	alert?: boolean;
	/** A figure below zero (net worth in deficit) reads in vermilion. */
	negative?: boolean;
	action?: React.ReactNode;
	children?: React.ReactNode;
}

/** A tile's figure, a note, at most a short list, and its one capture. */
export function TileBody({
	value,
	note,
	alert = false,
	negative = false,
	action,
	children,
}: BodyProps) {
	return (
		<>
			<p
				className={cn(
					"mt-1 truncate font-figures text-2xl font-semibold tracking-tight",
					value == null && "text-muted-foreground/50",
					negative && "text-negative",
				)}
			>
				{value ?? "—"}
			</p>
			{note && (
				<p className={cn("truncate text-xs", alert ? "text-negative" : "text-muted-foreground")}>
					{note}
				</p>
			)}
			{children && <div className="relative z-10 mt-3">{children}</div>}
			{/* A phone's half tile has no room beside the name: the action takes the tile's foot. */}
			{action && (
				<div className="relative z-10 mt-auto pt-3 sm:absolute sm:top-2 sm:right-4 sm:pt-0">
					{action}
				</div>
			)}
		</>
	);
}

const PULSE = "animate-pulse rounded-md bg-surface-2";

/** The body's figure and note lines (and a phone's foot action) while the summary loads, at
 * their real height. */
export function TileBodySkeleton({ action = false }: { action?: boolean }) {
	return (
		<>
			<div aria-hidden className="mt-1 flex h-8 items-center">
				<div className={cn(PULSE, "h-6 w-20")} />
			</div>
			<div aria-hidden className="flex h-4 items-center">
				<div className={cn(PULSE, "h-3 w-28")} />
			</div>
			{action && (
				<div aria-hidden className="mt-auto pt-3 sm:hidden">
					<div className={cn(PULSE, "h-8 w-full")} />
				</div>
			)}
		</>
	);
}

/** The tile's one capture, the same outline button the apps use for a row's quick update:
 * the full verb across a phone's tile, the short one in a wider tile's corner. */
export function TileAction({
	label,
	keys,
	children,
	...props
}: { label: string; keys: string } & React.ComponentProps<typeof Button>) {
	return (
		<Button
			variant="outline"
			size="sm"
			className="w-full sm:w-auto"
			aria-label={label}
			aria-keyshortcuts={keys}
			{...props}
		>
			<span className="sm:hidden">{label}</span>
			<span className="max-sm:hidden">{children}</span>
		</Button>
	);
}
