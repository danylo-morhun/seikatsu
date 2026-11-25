import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { Seal } from "@/features/home/components/Line";
import type { WeekEntry } from "@/features/week/lib/week";
import { APPS_CONFIG } from "@/lib/app-themes";

/** A row in the calendar's own words: the app's pigment, its title, and what it opens. */
export function Chip({
	entry,
	done = false,
	className,
}: {
	entry: WeekEntry;
	/** What already happened: quieter than what's planned. */
	done?: boolean;
	className?: string;
}) {
	return (
		<Link
			href={entry.href}
			prefetch={false}
			title={[entry.title, entry.note].filter(Boolean).join(" · ")}
			className={cn(
				APPS_CONFIG[entry.app].theme,
				"block min-w-0 truncate rounded-md border-l-2 px-1.5 py-0.5 text-xs leading-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
				done
					? "border-primary/40 text-muted-foreground hover:bg-surface"
					: "border-primary bg-primary/12 text-foreground hover:bg-primary/20",
				className,
			)}
		>
			{entry.time && <span className="mr-1 tabular-nums text-muted-foreground">{entry.time}</span>}
			{entry.title}
		</Link>
	);
}

/** A full row, as Week lists them: seal, title, note. */
export function Row({ entry, done = false }: { entry: WeekEntry; done?: boolean }) {
	return (
		<li className="flex min-h-14 items-center gap-3 py-2">
			<Seal href={entry.app} />
			<Link href={entry.href} prefetch={false} className="group min-w-0 flex-1 outline-none">
				<span
					className={cn(
						"block truncate text-sm font-medium group-hover:underline group-focus-visible:underline",
						done && "text-muted-foreground",
					)}
				>
					{entry.time && <span className="mr-1.5 tabular-nums">{entry.time}</span>}
					{entry.title}
				</span>
				{entry.note && (
					<span className="block truncate text-xs text-muted-foreground">{entry.note}</span>
				)}
			</Link>
		</li>
	);
}

/** A tiny dot in an app's pigment (the month's cells on a phone). */
export function Dot({ app }: { app: WeekEntry["app"] }) {
	return (
		<span aria-hidden className={cn(APPS_CONFIG[app].theme, "size-1.5 rounded-full bg-primary")} />
	);
}
