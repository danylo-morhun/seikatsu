import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { EntryLink } from "@/features/calendar/components/Events";
import type { DayFigures } from "@/features/calendar/lib/calendar";
import { type CalEntry, dragOf, type Source } from "@/features/calendar/lib/events";
import { colorStyle, sourceOf } from "@/features/calendar/lib/source";
import { km, plural } from "@/features/home/lib/format";
import type { Money } from "@/features/week/lib/week";
import type { AppHref } from "@/lib/modules";

/** The app's kanji in its own pigment: what marks a row as that app's, instead of a dot. */
export function Kanji({
	app,
	color,
	className,
}: {
	app: Source;
	color?: string;
	className?: string;
}) {
	const { theme, kanji, name } = sourceOf(app);
	return (
		<span
			role="img"
			aria-label={name}
			style={colorStyle(color)}
			className={cn(theme, "shrink-0 font-semibold leading-none text-primary", className)}
		>
			{kanji}
		</span>
	);
}

/**
 * A row in the calendar's own words: sealed by its app's kanji, on a faint wash of the app's
 * pigment when it's still ahead; plain when it already happened.
 */
export function Chip({
	entry,
	done = false,
	date,
	className,
}: {
	entry: CalEntry;
	/** The day it's shown on: given, a card or event can be dragged from it. */
	date?: string;
	/** What already happened: quieter than what's planned. */
	done?: boolean;
	className?: string;
}) {
	return (
		<EntryLink
			href={entry.href}
			event={entry.event}
			google={entry.google}
			style={colorStyle(entry.color)}
			drag={date && !done ? dragOf(entry, date) : undefined}
			title={[entry.time, entry.title, entry.note].filter(Boolean).join(" · ")}
			className={cn(
				sourceOf(entry.app).theme,
				"flex min-w-0 items-center gap-1.5 rounded-[0.45rem] px-1.5 py-[3px] text-xs leading-4 outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring",
				done
					? "text-muted-foreground hover:bg-surface hover:text-foreground"
					: "bg-primary/14 text-foreground hover:bg-primary/24",
				className,
			)}
		>
			<Kanji app={entry.app} color={entry.color} className="text-[10px]" />
			{entry.time && (
				<span className="shrink-0 tabular-nums text-muted-foreground">{entry.time}</span>
			)}
			<span className="min-w-0 truncate">{entry.title}</span>
		</EntryLink>
	);
}

/** A full row of the list: kanji, title and note, its time at the right. */
export function Row({ entry, done = false }: { entry: CalEntry; done?: boolean }) {
	return (
		<li className="relative flex min-h-14 items-center gap-3 py-2.5 transition-colors duration-150 ease-out has-[a:hover,button:hover]:bg-surface/60">
			<span
				aria-hidden
				style={colorStyle(entry.color)}
				className={cn(
					sourceOf(entry.app).theme,
					"flex size-8 shrink-0 items-center justify-center rounded-[0.55rem] text-sm font-semibold",
					done ? "bg-surface-2 text-muted-foreground" : "bg-primary/14 text-primary",
				)}
			>
				{sourceOf(entry.app).kanji}
			</span>
			<EntryLink
				href={entry.href}
				event={entry.event}
				google={entry.google}
				className="min-w-0 flex-1 outline-none after:absolute after:inset-0 focus-visible:after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring"
			>
				<span className={cn("block truncate text-sm font-medium", done && "text-muted-foreground")}>
					{entry.title}
				</span>
				{entry.note && (
					<span className="block truncate text-xs text-muted-foreground">{entry.note}</span>
				)}
			</EntryLink>
			{done ? (
				<HugeiconsIcon
					icon={CheckmarkCircle02Icon}
					aria-label="Done"
					className="size-4 shrink-0 text-muted-foreground"
				/>
			) : (
				entry.time && (
					<span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
						{entry.time}
					</span>
				)
			)}
		</li>
	);
}

/** What a day behind added up to, each figure sealed by its app: 黒 112 zł · 継 2/2. */
export function Recap({
	figures: f,
	money,
	className,
}: {
	figures: DayFigures;
	money: Money;
	className?: string;
}) {
	const parts: [AppHref, string][] = [];
	if (f.spent > 0) parts.push(["/kuroji", money(f.spent)]);
	if (f.ticks > 0) parts.push(["/keizoku", `${f.ticks}/${Math.max(f.ticks, f.expected)}`]);
	if (f.cardsDone > 0) parts.push(["/seiryu", plural(f.cardsDone, "card")]);
	if (f.pages > 0) parts.push(["/tsundoku", `${f.pages} p.`]);
	if (f.km > 0) parts.push(["/aisha", km(f.km)]);
	if (parts.length === 0) return null;
	return (
		<p
			className={cn(
				"flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4 tabular-nums text-muted-foreground",
				className,
			)}
		>
			{parts.map(([app, text]) => (
				<span key={app} className="inline-flex items-center gap-1 whitespace-nowrap">
					<Kanji app={app} className="text-[10px]" />
					{text}
				</span>
			))}
		</p>
	);
}

/** The apps a day has something from, as their kanji (a phone's month cell). */
export function Seals({ apps }: { apps: Source[] }) {
	if (apps.length === 0) return null;
	return (
		<span className="flex flex-wrap justify-center gap-0.5">
			{apps.slice(0, 4).map((app) => (
				<Kanji key={app} app={app} className="text-[9px]" />
			))}
		</span>
	);
}
