import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { FeedQuote } from "@/features/tsundoku/actions/quotes";
import type { ReadingDay, YearBook, YearStats } from "@/features/tsundoku/actions/stats";
import { BookCover } from "@/features/tsundoku/components/BookCover";
import { Stars, formatStars } from "@/features/tsundoku/components/Stars";
import { shiftDay } from "@/features/tsundoku/lib/streak";
import { BAR_FILL, barClip } from "@/lib/bar";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

function Figure({
	label,
	value,
	note,
	lead = false,
	index,
	decimals = 0,
	suffix,
}: {
	label: string;
	value: number | null;
	note?: string;
	lead?: boolean;
	index: number;
	decimals?: number;
	suffix?: string;
}) {
	return (
		<div className="min-w-0 animate-rise py-1" style={rise(index)}>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p
				data-total={lead ? "lead" : undefined}
				className={cn(
					"mt-1 truncate font-figures font-semibold tracking-tight",
					lead ? "text-3xl md:text-4xl" : "text-2xl md:text-[1.75rem]",
				)}
			>
				{value == null ? "—" : <AnimatedNumber value={value} decimals={decimals} />}
				{value != null && suffix && (
					<span className="ml-1 text-base font-medium text-muted-foreground">{suffix}</span>
				)}
			</p>
			{note && <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p>}
		</div>
	);
}

/** The year at a glance: books read leads, then pages, the average rating and the streak. */
export function YearFigures({ stats, isCurrent }: { stats: YearStats; isCurrent: boolean }) {
	const streak = isCurrent ? stats.streak.current : longestIn(stats.days);
	const logged = stats.months.reduce((s, m) => s + m, 0);
	return (
		<section
			aria-label="Summary"
			className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-4 [&>*]:rounded-2xl [&>*]:bg-surface [&>*]:px-4 [&>*]:py-3.5"
		>
			<div className="col-span-2 md:col-span-1">
				<Figure
					lead
					index={0}
					label={`Books read · ${stats.year}`}
					value={stats.finished.length}
					note={
						isCurrent && stats.counts.reading > 0
							? `${stats.counts.reading} on the go · ${stats.counts.want} on the pile`
							: undefined
					}
				/>
			</div>
			<Figure
				index={1}
				label="Pages in finished books"
				value={stats.pages}
				note={logged > 0 ? `${logged.toLocaleString("en-US")} pages logged` : undefined}
			/>
			<Figure
				index={2}
				label="Average rating"
				value={stats.avgRating != null ? stats.avgRating / 2 : null}
				decimals={1}
				suffix="★"
			/>
			<div className="col-span-2 md:col-span-1">
				<Figure
					index={3}
					label={isCurrent ? "Reading streak" : "Longest streak"}
					value={streak}
					suffix={streak === 1 ? "day" : "days"}
					note={
						isCurrent
							? `Longest ${stats.streak.longest} ${stats.streak.longest === 1 ? "day" : "days"}`
							: undefined
					}
				/>
			</div>
		</section>
	);
}

/** The longest run of reading days inside one year's days (ascending). */
function longestIn(days: ReadingDay[]): number {
	let best = 0;
	let run = 0;
	let prev: string | null = null;
	for (const d of days) {
		run = prev && shiftDay(prev, 1) === d.date ? run + 1 : 1;
		best = Math.max(best, run);
		prev = d.date;
	}
	return best;
}

const GRID = "grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6";

/** The covers of the year's books, newest first: the wall the year built. */
export function YearCovers({ books }: { books: YearBook[] }) {
	if (books.length === 0) {
		return <p className="py-6 text-sm text-muted-foreground">No books finished this year yet.</p>;
	}
	return (
		<ol className={GRID}>
			{books.map((b, i) => (
				<li key={b.id} className="animate-rise" style={rise(Math.min(i, 8))}>
					<Link
						href={`/tsundoku/${b.id}`}
						prefetch={false}
						className="group block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						aria-label={`${b.title}${b.rating ? `, ${formatStars(b.rating)} stars` : ""}`}
					>
						<BookCover
							coverUrl={b.coverUrl}
							bookId={b.id}
							stored={b.coverBlob}
							title={b.title}
							className="transition-[filter] duration-150 ease-out group-hover:brightness-110"
						/>
						{b.rating != null && <Stars rating={b.rating} className="mt-1.5" />}
					</Link>
				</li>
			))}
		</ol>
	);
}

const MONTH = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

/** One row per month, newest first: books finished and pages logged, each on its own scale. */
export function MonthRows({ stats, lastMonth }: { stats: YearStats; lastMonth: number }) {
	const maxBooks = Math.max(1, ...stats.monthBooks);
	const maxPages = Math.max(1, ...stats.months);
	const months = Array.from({ length: lastMonth + 1 }, (_, m) => lastMonth - m);
	const active = (m: number) => !!stats.monthBooks[m] || !!stats.months[m];
	if (!months.some(active)) {
		return <p className="py-6 text-sm text-muted-foreground">Nothing read yet this year.</p>;
	}
	// Runs of quiet months fold into one line, as Kuroji folds empty months.
	const rows: ({ kind: "month"; m: number } | { kind: "gap"; from: number; to: number })[] = [];
	for (const m of months) {
		const prev = rows.at(-1);
		if (active(m)) rows.push({ kind: "month", m });
		else if (prev?.kind === "gap") prev.from = m;
		else rows.push({ kind: "gap", from: m, to: m });
	}
	const name = (m: number) => MONTH.format(new Date(Date.UTC(stats.year, m, 1)));

	return (
		<>
			<ol className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
				{rows.map((row, i) => {
					if (row.kind === "gap") {
						return (
							<li key={`gap-${row.to}`} className="py-2.5 text-xs text-muted-foreground">
								{row.from === row.to ? name(row.from) : `${name(row.from)} – ${name(row.to)}`} · no
								reading
							</li>
						);
					}
					const { m } = row;
					const books = stats.monthBooks[m] ?? 0;
					const pages = stats.months[m] ?? 0;
					return (
						<li
							key={m}
							className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5"
						>
							<span className="text-xs text-muted-foreground">{name(m)}</span>
							<span className="flex flex-col gap-1" aria-hidden>
								<span className="h-1.5 rounded-full bg-surface-2">
									<span
										className={cn("block h-full rounded-full bg-primary/80", BAR_FILL)}
										style={barClip(books / maxBooks, i)}
									/>
								</span>
								<span className="h-1.5 rounded-full bg-surface-2">
									<span
										className={cn("block h-full rounded-full bg-foreground/70", BAR_FILL)}
										style={barClip(pages / maxPages, i)}
									/>
								</span>
							</span>
							<span className="text-right">
								<span
									className={cn(
										"block font-figures text-sm font-medium",
										!books && "text-muted-foreground",
									)}
								>
									{books} {books === 1 ? "book" : "books"}
								</span>
								<span className="block font-figures text-[11px] text-muted-foreground">
									{pages.toLocaleString("en-US")} p.
								</span>
							</span>
						</li>
					);
				})}
			</ol>
			<p className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<span aria-hidden className="size-2 rounded-full bg-primary/80" /> Books finished
				</span>
				<span className="flex items-center gap-1.5">
					<span aria-hidden className="size-2 rounded-full bg-foreground/70" /> Pages logged
				</span>
			</p>
		</>
	);
}

const LEVELS = ["bg-surface-2", "bg-primary/30", "bg-primary/55", "bg-primary/80", "bg-primary"];
const CELL_DATE = new Intl.DateTimeFormat("en", {
	weekday: "short",
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/**
 * The year's reading days, a column per week (Monday on top). Days are calendar strings from
 * the server, so a day is the day it was read in, whatever the browser's zone.
 */
export function ReadingCalendar({
	year,
	days,
	today,
}: {
	year: number;
	days: ReadingDay[];
	today: string;
}) {
	const pages = new Map(days.map((d) => [d.date, d.pages]));
	const max = Math.max(1, ...days.map((d) => d.pages));
	const first = `${year}-01-01`;
	const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
	const start = shiftDay(first, -weekday);
	const last = `${year}-12-31`;
	const cells: { date: string; inYear: boolean; future: boolean }[] = [];
	// This year's calendar ends with this week: the newest day sits at the edge.
	const end = today < last ? today : last;
	for (let d = start; d <= end || cells.length % 7 !== 0; d = shiftDay(d, 1)) {
		cells.push({ date: d, inYear: d >= first && d <= last, future: d > today });
	}
	const level = (p: number) => (p <= 0 ? 0 : Math.min(4, Math.ceil((p / max) * 4)));

	return (
		// Right-to-left scrolling keeps the newest weeks in view on a phone; the grid reads ltr.
		<div className="-mx-4 overflow-x-auto px-4 pb-1 [direction:rtl] [scrollbar-width:thin] sm:mx-0 sm:px-0 sm:[direction:ltr]">
			<div
				role="img"
				aria-label={`${days.length} reading ${days.length === 1 ? "day" : "days"} in ${year}`}
				className="inline-grid grid-flow-col grid-rows-7 gap-[3px] [direction:ltr]"
			>
				{cells.map((c) => {
					const p = pages.get(c.date) ?? 0;
					return (
						<span
							key={c.date}
							title={
								c.inYear && !c.future
									? `${CELL_DATE.format(new Date(`${c.date}T00:00:00Z`))} · ${p} pages`
									: undefined
							}
							className={cn(
								"size-[11px] rounded-[3px]",
								!c.inYear || c.future ? "bg-transparent" : LEVELS[level(p)],
								c.date === today && "ring-1 ring-foreground/50",
							)}
						/>
					);
				})}
			</div>
		</div>
	);
}

/** The year's best books, ranked: stars beside the title, a bar for the score. */
export function TopRated({ books }: { books: YearBook[] }) {
	const rated = books
		.filter((b) => b.rating != null)
		.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.finishedAt.localeCompare(a.finishedAt))
		.slice(0, 8);
	if (rated.length === 0)
		return <p className="py-6 text-sm text-muted-foreground">No ratings yet.</p>;
	return (
		<ol className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
			{rated.map((b, i) => (
				<li key={b.id} className="pb-1">
					<Link
						href={`/tsundoku/${b.id}`}
						prefetch={false}
						className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 rounded-md py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span className="truncate text-sm">{b.title}</span>
						<span className="font-figures text-sm font-medium">{formatStars(b.rating ?? 0)}★</span>
						<span aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-2">
							<span
								className={cn(
									"block h-full rounded-full bg-primary/80 group-hover:bg-primary",
									BAR_FILL,
								)}
								style={barClip((b.rating ?? 0) / 10, i)}
							/>
						</span>
					</Link>
				</li>
			))}
		</ol>
	);
}

/** Passages saved this year, newest first, each under its book. */
export function QuoteFeed({ quotes }: { quotes: FeedQuote[] }) {
	if (quotes.length === 0) {
		return <p className="py-6 text-sm text-muted-foreground">No quotes saved this year.</p>;
	}
	return (
		<ul className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
			{quotes.map((q) => (
				<li key={q.id} className="py-3">
					<blockquote className="border-l-2 border-primary/40 pl-3">
						<p className="line-clamp-6 text-sm leading-relaxed whitespace-pre-wrap break-words">
							{q.text}
						</p>
						<footer className="mt-1 truncate text-xs text-muted-foreground">
							<Link
								href={`/tsundoku/${q.bookId}`}
								prefetch={false}
								className="hover:text-foreground"
							>
								{q.bookTitle}
							</Link>
							{q.page != null && <span className="font-figures"> · p. {q.page}</span>}
						</footer>
					</blockquote>
				</li>
			))}
		</ul>
	);
}

/** Longest, shortest, fastest: the year's records as a hairline list. */
export function Records({ stats }: { stats: YearStats }) {
	const rows = [
		stats.longest && {
			label: "Longest",
			book: stats.longest,
			value: `${stats.longest.pageCount} pages`,
		},
		stats.shortest && {
			label: "Shortest",
			book: stats.shortest,
			value: `${stats.shortest.pageCount} pages`,
		},
		stats.fastest?.days != null && {
			label: "Fastest",
			book: stats.fastest,
			value: `${stats.fastest.days} ${stats.fastest.days === 1 ? "day" : "days"}`,
		},
	].filter((r): r is { label: string; book: YearBook; value: string } => !!r);
	if (rows.length === 0) return null;
	return (
		<ul className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
			{rows.map((r) => (
				<li key={r.label}>
					<Link
						href={`/tsundoku/${r.book.id}`}
						prefetch={false}
						className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-md py-2.5 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring md:-mx-2 md:px-2"
					>
						<span className="text-xs text-muted-foreground">{r.label}</span>
						<span className="truncate text-sm">{r.book.title}</span>
						<span className="font-figures text-sm font-medium">{r.value}</span>
					</Link>
				</li>
			))}
		</ul>
	);
}
