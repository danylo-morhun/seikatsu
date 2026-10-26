"use client";

import { ReadingDialog } from "@/features/aisha/components/ReadingDialog";
import type { Today } from "@/features/home/lib/today";
import { checkDay, uncheckDay } from "@/features/keizoku/actions/logs";
import { CheckButton } from "@/features/keizoku/components/HabitRow";
import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { setProgress } from "@/features/tsundoku/actions/books";
import { ProgressDialog, type ProgressTarget } from "@/features/tsundoku/components/ProgressDialog";
import { ProgressMeter } from "@/features/tsundoku/components/ProgressMeter";
import { APPS_CONFIG } from "@/lib/app-themes";
import { pageKey } from "@/lib/capture-shortcut";
import type { Workspace } from "@/lib/session";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

type AppHref = keyof typeof APPS_CONFIG;
const APP_HREFS = Object.keys(APPS_CONFIG) as AppHref[];

function greeting(hour: number) {
	if (hour < 5) return "Good night";
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

/** Whole units: the home reads amounts at a glance; Kuroji keeps the cents. */
function money(amount: number, currency: string) {
	return new Intl.NumberFormat("pl-PL", {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		useGrouping: "always",
		maximumFractionDigits: 0,
	}).format(amount);
}

const km = (n: number) => `${new Intl.NumberFormat("pl-PL").format(Math.abs(n))} km`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function longDate(iso: string) {
	return new Intl.DateTimeFormat("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC",
	}).format(new Date(`${iso}T00:00:00Z`));
}

function daysAgo(due: string, today: string) {
	return Math.round(
		(Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86_400_000,
	);
}

// ── Figures ───────────────────────────────────────────────────────────────────

interface FigureProps {
	href: AppHref;
	label: string;
	value: string | null;
	note?: string | null;
	alert?: boolean;
	/** A figure below zero (net worth in deficit) reads in vermilion. */
	negative?: boolean;
	lead?: boolean;
	index: number;
}

/** One app's state: its kanji seal, a figure, a note. The whole figure opens the app. */
function Figure({
	href,
	label,
	value,
	note,
	alert = false,
	negative = false,
	lead = false,
	index,
}: FigureProps) {
	const app = APPS_CONFIG[href];
	return (
		<Link
			href={href}
			prefetch
			className={cn(
				app.theme,
				"group min-w-0 animate-rise rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
				lead && "col-span-2 sm:col-span-1",
			)}
			style={{ "--i": index } as CSSProperties}
		>
			<p className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
				<span aria-hidden className="font-semibold text-primary">
					{app.kanji}
				</span>
				{label}
			</p>
			<p
				data-total={lead ? "lead" : undefined}
				className={cn(
					"mt-1 truncate font-figures font-semibold tracking-tight",
					lead ? "text-3xl md:text-4xl" : "text-2xl md:text-[1.75rem] xl:text-2xl",
					value == null && "text-muted-foreground/50",
					negative && "text-negative",
				)}
			>
				{value ?? "—"}
			</p>
			{note && (
				<p
					className={cn("mt-1 truncate text-xs", alert ? "text-negative" : "text-muted-foreground")}
				>
					{note}
				</p>
			)}
		</Link>
	);
}

function Figures({ data, today }: { data: Today; today: string }) {
	const { money: m, habits, reading, jobs, cards, car } = data;
	const left = habits ? habits.habits.filter((h) => !h.done).length : 0;
	const book = reading?.[0];
	const overdue = cards?.filter((c) => c.dueDate < today).length ?? 0;
	const next = car?.next;

	return (
		<section
			aria-label="Every app today"
			className="grid grid-cols-2 gap-x-6 gap-y-6 border-b border-rule pb-8 sm:grid-cols-3 xl:grid-cols-[1.4fr_repeat(5,minmax(0,1fr))] xl:gap-0 xl:divide-x xl:divide-rule xl:[&>*]:px-6 xl:[&>*:first-child]:pl-0"
		>
			<Figure
				lead
				index={0}
				href="/kuroji"
				label="Net worth"
				negative={(m?.netWorth ?? 0) < 0}
				value={m ? money(m.netWorth, m.currency) : null}
				note={m ? `${money(m.spentThisMonth, m.currency)} spent this month` : "Not set up"}
			/>
			<Figure
				index={1}
				href="/keizoku"
				label="Habits"
				value={
					habits && habits.habits.length > 0
						? `${habits.habits.length - left} / ${habits.habits.length}`
						: null
				}
				note={
					!habits || habits.habits.length === 0
						? "Nothing due today"
						: left === 0
							? "All done today"
							: `${left} left today`
				}
			/>
			<Figure
				index={2}
				href="/tsundoku"
				label="Reading"
				value={book ? `p. ${book.currentPage}` : null}
				note={
					book
						? [
								book.pageCount && `of ${book.pageCount}`,
								book.daysToFinish && `${plural(book.daysToFinish, "day")} left`,
							]
								.filter(Boolean)
								.join(" · ") || book.title
						: "No book on the go"
				}
			/>
			<Figure
				index={3}
				href="/kyuu"
				label="To send"
				value={jobs ? String(jobs.toSend) : null}
				note={
					jobs
						? jobs.ghostDue > 0
							? `${jobs.ghostDue} to close`
							: `${jobs.waiting} waiting`
						: null
				}
			/>
			<Figure
				index={4}
				href="/seiryu"
				label="Cards due"
				value={cards ? String(cards.length) : null}
				note={
					cards
						? overdue > 0
							? `${overdue} overdue`
							: cards.length > 0
								? "Due today"
								: "Nothing due"
						: null
				}
				alert={overdue > 0}
			/>
			<Figure
				index={5}
				href="/aisha"
				label={next ? next.name : "Car"}
				value={
					next?.kmLeft != null
						? km(next.kmLeft)
						: next?.daysLeft != null
							? plural(Math.abs(next.daysLeft), "day")
							: car
								? new Intl.NumberFormat("pl-PL").format(car.currentKm)
								: null
				}
				note={
					!car
						? "Not set up"
						: !next
							? "km on the odometer"
							: next.status === "overdue"
								? "Overdue"
								: next.kmLeft != null
									? "to go"
									: "left"
				}
				alert={next?.status === "overdue"}
			/>
		</section>
	);
}

// ── Today's lists ─────────────────────────────────────────────────────────────

function SectionTitle({ children, href }: { children: React.ReactNode; href?: string }) {
	return (
		<div className="mb-1 flex items-baseline justify-between gap-4">
			<h2 className="text-sm font-medium">{children}</h2>
			{href && (
				<Link
					href={href}
					prefetch
					className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					Open
					<HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
				</Link>
			)}
		</div>
	);
}

function Habits({
	habits: saved,
	today,
}: { habits: NonNullable<Today["habits"]>["habits"]; today: string }) {
	const [, startTransition] = useTransition();
	const [habits, setDone] = useOptimistic(saved, (list, p: { id: string; done: boolean }) =>
		list.map((h) => (h.id === p.id ? { ...h, done: p.done } : h)),
	);

	function toggle(h: (typeof habits)[number]) {
		startTransition(async () => {
			setDone({ id: h.id, done: !h.done });
			const result = await (h.done ? uncheckDay(h.id, today) : checkDay(h.id, today)).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<ul className="theme-keizoku divide-y divide-rule border-y border-rule">
			{habits.map((h) => (
				<li key={h.id} className="flex min-h-12 items-center gap-2">
					<CheckButton
						done={h.done}
						label={`${h.name}: ${h.done ? "done today" : "mark done today"}`}
						onClick={() => toggle(h)}
						className="-ml-1.5"
					/>
					<span aria-hidden className="shrink-0">
						{h.emoji}
					</span>
					<Link
						href={`/keizoku/${h.id}`}
						prefetch={false}
						className={cn(
							"min-w-0 truncate text-sm transition-colors hover:text-foreground",
							h.done && "text-muted-foreground line-through decoration-muted-foreground/40",
						)}
					>
						{h.name}
					</Link>
				</li>
			))}
		</ul>
	);
}

function CardsDue({ cards, today }: { cards: NonNullable<Today["cards"]>; today: string }) {
	return (
		<ul className="divide-y divide-rule border-y border-rule">
			{cards.slice(0, 6).map((c) => {
				const late = daysAgo(c.dueDate, today);
				return (
					<li key={c.id} className="relative flex items-center gap-3 py-2.5 hover:bg-surface/60">
						<Link
							href={`/seiryu/${c.projectId}/${c.id}`}
							prefetch={false}
							className="min-w-0 flex-1 truncate text-sm outline-none after:absolute after:inset-0 focus-visible:underline"
						>
							{c.title}
						</Link>
						<span className="shrink-0 truncate text-xs text-muted-foreground">{c.projectName}</span>
						<span
							className={cn(
								"w-24 shrink-0 text-right font-figures text-xs",
								late > 0 ? "text-negative" : "text-muted-foreground",
							)}
						>
							{late === 0 ? "Today" : late === 1 ? "Yesterday" : `${late} days late`}
						</span>
					</li>
				);
			})}
		</ul>
	);
}

function Reading({
	books,
	onUpdate,
}: {
	books: NonNullable<Today["reading"]>;
	onUpdate: (book: ProgressTarget) => void;
}) {
	return (
		<ul className="theme-tsundoku divide-y divide-rule border-y border-rule">
			{books.slice(0, 3).map((b, i) => (
				<li key={b.id} className="flex items-center gap-4 py-3">
					<div className="min-w-0 flex-1">
						<Link
							href={`/tsundoku/${b.id}`}
							prefetch={false}
							className="block truncate text-sm font-medium hover:underline hover:underline-offset-4"
						>
							{b.title}
						</Link>
						{b.authors.length > 0 && (
							<p className="truncate text-xs text-muted-foreground">{b.authors.join(", ")}</p>
						)}
						<ProgressMeter
							className="mt-2"
							currentPage={b.currentPage}
							pageCount={b.pageCount}
							daysToFinish={b.daysToFinish}
							index={i}
						/>
					</div>
					<button
						type="button"
						onClick={() => onUpdate(b)}
						aria-keyshortcuts={i === 0 ? "P" : undefined}
						className="h-8 shrink-0 rounded-md border border-input px-3 text-sm transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						Log pages
					</button>
				</li>
			))}
		</ul>
	);
}

// ── Capture ───────────────────────────────────────────────────────────────────

const captureRow =
	"group flex h-11 w-full items-center gap-3 rounded-md px-2 -mx-2 text-left text-sm outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring";

function CaptureLabel({
	href,
	children,
	hint,
}: { href: AppHref; children: React.ReactNode; hint?: string }) {
	const app = APPS_CONFIG[href];
	return (
		<>
			<span aria-hidden className={cn(app.theme, "w-4 text-center font-semibold text-primary")}>
				{app.kanji}
			</span>
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{hint && <span className="shrink-0 truncate text-xs text-muted-foreground">{hint}</span>}
		</>
	);
}

// ── View ──────────────────────────────────────────────────────────────────────

interface Props {
	data: Today;
	today: string;
	workspace: Workspace;
	firstName: string | null;
}

export function TodayView({ data, today, workspace, firstName }: Props) {
	const router = useRouter();
	const [hour, setHour] = useState<number | null>(null);
	const [progressBook, setProgressBook] = useState<ProgressTarget | null>(null);
	const [mileageOpen, setMileageOpen] = useState(false);
	const hasCar = !!data.car;
	const [, startTransition] = useTransition();

	// The greeting follows the reader's clock, which the server doesn't know.
	useEffect(() => setHour(new Date().getHours()), []);

	const habits = data.habits?.habits ?? [];
	const left = habits.filter((h) => !h.done).length;
	const book = data.reading?.[0];
	const cards = data.cards ?? [];
	const overdue = cards.filter((c) => c.dueDate < today).length;

	// 1–6 open the apps in sidebar order; P logs pages of the book being read, M the
	// odometer (N is the transaction dialog's).
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const key = pageKey(e);
			if (!key) return;
			const app = /^[1-6]$/.test(key) ? APP_HREFS[Number(key) - 1] : undefined;
			if (app) {
				e.preventDefault();
				router.push(app);
			} else if (key === "p" && book) {
				e.preventDefault();
				setProgressBook(book);
			} else if (key === "m" && hasCar) {
				e.preventDefault();
				setMileageOpen(true);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router, book, hasCar]);

	function saveProgress(bookId: string, page: number) {
		startTransition(async () => {
			const result = await setProgress(bookId, { currentPage: page }).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
		});
	}

	const attention = [
		left > 0 && `${plural(left, "habit")} left`,
		overdue > 0 && `${plural(overdue, "card")} overdue`,
		data.car?.next?.status === "overdue" && "car service overdue",
		(data.jobs?.toSend ?? 0) > 0 && `${data.jobs?.toSend} to send`,
	].filter(Boolean);

	return (
		<div className="space-y-10 px-4 pt-6 pb-16 sm:px-8 md:py-8">
			<header className="animate-rise">
				<h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{longDate(today)}</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					{hour != null && firstName ? `${greeting(hour)}, ${firstName}. ` : ""}
					{attention.length > 0 ? `${attention.join(", ")}.` : "Nothing waiting on you today."}
				</p>
			</header>

			<Figures data={data} today={today} />

			<div
				className="grid animate-rise gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12"
				style={{ "--i": 6 } as CSSProperties}
			>
				<div className="space-y-10">
					<section aria-labelledby="habits-title">
						<SectionTitle href="/keizoku">
							<span id="habits-title">Today's habits</span>
						</SectionTitle>
						{habits.length > 0 ? (
							<Habits habits={habits} today={data.habits?.today ?? today} />
						) : (
							<p className="border-y border-rule py-3 text-sm text-muted-foreground">
								No habits due today.
							</p>
						)}
					</section>

					{cards.length > 0 && (
						<section aria-labelledby="cards-title">
							<SectionTitle href="/seiryu">
								<span id="cards-title">Cards due</span>
							</SectionTitle>
							<CardsDue cards={cards} today={today} />
						</section>
					)}

					{data.reading && data.reading.length > 0 && (
						<section aria-labelledby="reading-title">
							<SectionTitle href="/tsundoku">
								<span id="reading-title">Reading now</span>
							</SectionTitle>
							<Reading books={data.reading} onUpdate={setProgressBook} />
						</section>
					)}
				</div>

				<section aria-labelledby="capture-title" className="lg:pt-0">
					<SectionTitle>
						<span id="capture-title">Add</span>
					</SectionTitle>
					<div className="flex flex-col border-y border-rule py-1">
						<AddTransactionModal
							workspaceId={workspace.id}
							baseCurrency={workspace.baseCurrency}
							shortcut
							trigger={
								<button type="button" className={captureRow} aria-keyshortcuts="N">
									<CaptureLabel href="/kuroji">Transaction</CaptureLabel>
								</button>
							}
						/>
						{book && (
							<button
								type="button"
								className={captureRow}
								aria-keyshortcuts="P"
								onClick={() => setProgressBook(book)}
							>
								<CaptureLabel href="/tsundoku" hint={book.title}>
									Pages read
								</CaptureLabel>
							</button>
						)}
						{data.car && (
							<button
								type="button"
								className={captureRow}
								aria-keyshortcuts="M"
								onClick={() => setMileageOpen(true)}
							>
								<CaptureLabel href="/aisha" hint={km(data.car.currentKm)}>
									Mileage
								</CaptureLabel>
							</button>
						)}
						<Link href="/kyuu" prefetch className={captureRow}>
							<CaptureLabel
								href="/kyuu"
								hint={data.jobs ? `${data.jobs.toSend} to send` : undefined}
							>
								Application queue
							</CaptureLabel>
						</Link>
						<Link href="/seiryu" prefetch className={captureRow}>
							<CaptureLabel href="/seiryu">Boards</CaptureLabel>
						</Link>
					</div>
				</section>
			</div>

			{data.car && (
				<ReadingDialog
					open={mileageOpen}
					onOpenChange={setMileageOpen}
					vehicleId={data.car.vehicleId}
					currentKm={data.car.currentKm}
				/>
			)}
			<ProgressDialog
				book={progressBook}
				onOpenChange={(open) => !open && setProgressBook(null)}
				onSave={saveProgress}
			/>
		</div>
	);
}
