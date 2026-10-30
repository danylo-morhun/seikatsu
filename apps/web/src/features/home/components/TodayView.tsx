"use client";

import { ReadingDialog } from "@/features/aisha/components/ReadingDialog";
import { StartHere } from "@/features/home/components/StartHere";
import type { Today } from "@/features/home/lib/today";
import { CheckButton } from "@/features/keizoku/components/HabitRow";
import { tickDay } from "@/features/keizoku/lib/offline";
import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { usePendingOps } from "@/features/pwa/lib/use-outbox";
import { ProgressDialog, type ProgressTarget } from "@/features/tsundoku/components/ProgressDialog";
import { ProgressMeter } from "@/features/tsundoku/components/ProgressMeter";
import { saveProgress as sendProgress } from "@/features/tsundoku/lib/offline";
import { APPS_CONFIG } from "@/lib/app-themes";
import { pageKey } from "@/lib/capture-shortcut";
import type { Workspace } from "@/lib/session";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type CSSProperties,
	useEffect,
	useMemo,
	useOptimistic,
	useState,
	useTransition,
} from "react";
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

// ── Tiles ─────────────────────────────────────────────────────────────────────

interface TileProps {
	href: AppHref;
	value: string | null;
	note?: string | null;
	alert?: boolean;
	/** A figure below zero (net worth in deficit) reads in vermilion. */
	negative?: boolean;
	/** Carries a list: the full row on a phone, half of it on a desktop. */
	wide?: boolean;
	/** The odd one out among the small tiles: takes two columns so the row has no hole. */
	fill?: boolean;
	action?: React.ReactNode;
	children?: React.ReactNode;
	index: number;
}

/** One app at a glance: its seal and name as the sidebar has them, one figure, a note, at most a short list. The tile opens the app. */
function Tile({
	href,
	value,
	note,
	alert = false,
	negative = false,
	wide = false,
	fill = false,
	action,
	children,
	index,
}: TileProps) {
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
		</section>
	);
}

/** The tile's one capture, the same outline button the apps use for a row's quick update:
 * the full verb across a phone's tile, the short one in a wider tile's corner. */
function TileAction({
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

function Habits({
	habits: server,
	today,
}: { habits: NonNullable<Today["habits"]>["habits"]; today: string }) {
	const [, startTransition] = useTransition();
	// Today's ticks queued offline show until the server has them.
	const pending = usePendingOps("keizoku.");
	const saved = useMemo(
		() =>
			server.map((h) => {
				let done = h.done;
				for (const op of pending) {
					const args = op.args as { habitId?: string; date?: string };
					if (args.habitId !== h.id || args.date !== today) continue;
					if (op.name === "keizoku.checkDay") done = true;
					if (op.name === "keizoku.uncheckDay") done = false;
				}
				return { ...h, done };
			}),
		[server, pending, today],
	);
	const [habits, setDone] = useOptimistic(saved, (list, p: { id: string; done: boolean }) =>
		list.map((h) => (h.id === p.id ? { ...h, done: p.done } : h)),
	);

	function toggle(h: (typeof habits)[number]) {
		startTransition(async () => {
			setDone({ id: h.id, done: !h.done });
			const result = await tickDay(h, today, !h.done).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<ul className="-my-1">
			{habits.map((h) => (
				<li key={h.id} className="flex min-h-10 items-center gap-1.5">
					<CheckButton
						done={h.done}
						label={`${h.name}: ${h.done ? "done today" : "mark done today"}`}
						onClick={() => toggle(h)}
						className="mr-1.5"
					/>
					<span aria-hidden className="shrink-0">
						{h.emoji}
					</span>
					<span
						className={cn(
							"min-w-0 truncate text-sm",
							h.done && "text-muted-foreground line-through decoration-muted-foreground/40",
						)}
					>
						{h.name}
					</span>
				</li>
			))}
		</ul>
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
	const hidden = APP_HREFS.filter((href) => workspace.hiddenApps.includes(href));
	const listed = useMemo(
		() => APP_HREFS.filter((href) => !workspace.hiddenApps.includes(href)),
		[workspace.hiddenApps],
	);

	// 1–7 open the apps in sidebar order (set-aside ones skipped); P logs pages of the book being read, M the
	// odometer (N is the transaction dialog's).
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const key = pageKey(e);
			if (!key) return;
			const app = /^[1-7]$/.test(key) ? listed[Number(key) - 1] : undefined;
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
	}, [router, book, hasCar, listed]);

	function saveProgress(bookId: string, page: number) {
		startTransition(async () => {
			const title = data.reading?.find((b) => b.id === bookId)?.title ?? "Book";
			const result = await sendProgress({ id: bookId, title }, page).catch(() => ({
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
		(data.wants?.decide ?? 0) > 0 && `${plural(data.wants?.decide ?? 0, "want")} to decide`,
	].filter(Boolean);

	const m = data.money;
	const jobs = data.jobs;
	const wants = data.wants;
	const next = data.car?.next;
	// Undone first: the tile shows what's left, then what's ticked.
	const habitList = [...habits].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 4);
	// An app with nothing in it yet waits on the start list, not as a tile of dashes.
	const fresh = listed.filter((href) => data.started[href] === false);
	const isNew = APP_HREFS.every((href) => data.started[href] === false);
	const shows = (href: AppHref) => listed.includes(href) && !fresh.includes(href);
	const smalls = (["/kuroji", "/aisha", "/seiryu", "/kyuu", "/hoshii"] as const).filter(shows);
	const fill = smalls.length % 2 === 1 ? smalls.at(-1) : undefined;
	let tile = 0;

	return (
		<div className="space-y-6 px-4 pt-5 pb-16 sm:px-8 md:space-y-8 md:py-8">
			{isNew ? (
				<header className="max-w-2xl animate-rise">
					<h1 className="text-xl font-semibold tracking-tight md:text-3xl">
						{firstName ? `Welcome, ${firstName}.` : "Welcome."}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground md:text-base">
						生活 — everyday life. Seven small apps for money, projects, books, habits, the job
						search, the car and the things you want, under one sign-in. Start with whichever you
						need; the rest wait here until you do, and each one shows up on this page once it has
						something in it.
					</p>
				</header>
			) : (
				<header className="animate-rise">
					<h1 className="text-xl font-semibold tracking-tight md:text-3xl">{longDate(today)}</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						{hour != null && firstName ? `${greeting(hour)}, ${firstName}. ` : ""}
						{attention.length > 0 ? `${attention.join(", ")}.` : "Nothing waiting on you today."}
					</p>
				</header>
			)}

			{!isNew && (
				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					{shows("/kuroji") && (
						<Tile
							index={tile++}
							href="/kuroji"
							fill={fill === "/kuroji"}
							negative={(m?.netWorth ?? 0) < 0}
							value={m ? money(m.netWorth, m.currency) : null}
							note={m ? `Net worth · ${money(m.spentThisMonth, m.currency)} spent` : "Not set up"}
							action={
								<AddTransactionModal
									workspaceId={workspace.id}
									baseCurrency={workspace.baseCurrency}
									shortcut
									trigger={
										<TileAction label="Add transaction" keys="N">
											Add
										</TileAction>
									}
								/>
							}
						/>
					)}

					{shows("/aisha") && (
						<Tile
							index={tile++}
							href="/aisha"
							fill={fill === "/aisha"}
							value={
								next?.kmLeft != null
									? km(next.kmLeft)
									: next?.daysLeft != null
										? plural(Math.abs(next.daysLeft), "day")
										: data.car
											? km(data.car.currentKm)
											: null
							}
							note={
								!data.car
									? "Not set up"
									: !next
										? "on the odometer"
										: next.status === "overdue"
											? `${next.name} overdue`
											: `to ${next.name}`
							}
							alert={next?.status === "overdue"}
							action={
								data.car && (
									<TileAction label="Log mileage" keys="M" onClick={() => setMileageOpen(true)}>
										Log
									</TileAction>
								)
							}
						/>
					)}

					{shows("/seiryu") && (
						<Tile
							index={tile++}
							href="/seiryu"
							fill={fill === "/seiryu"}
							value={String(cards.length)}
							note={
								overdue > 0
									? `${plural(overdue, "card")} overdue`
									: cards.length > 0
										? "cards due today"
										: "No cards due"
							}
							alert={overdue > 0}
						/>
					)}

					{shows("/kyuu") && (
						<Tile
							index={tile++}
							href="/kyuu"
							fill={fill === "/kyuu"}
							value={jobs ? String(jobs.toSend) : null}
							note={
								jobs
									? jobs.ghostDue > 0
										? `to send · ${jobs.ghostDue} to close`
										: `to send · ${jobs.waiting} waiting`
									: null
							}
						/>
					)}

					{shows("/hoshii") && (
						<Tile
							index={tile++}
							href="/hoshii"
							fill={fill === "/hoshii"}
							value={
								wants
									? String(
											wants.decide > 0
												? wants.decide
												: wants.canBuy > 0
													? wants.canBuy
													: wants.cooling,
										)
									: null
							}
							note={
								!wants
									? null
									: wants.decide > 0
										? `to decide${wants.canBuy > 0 ? ` · ${wants.canBuy} can buy` : ""}`
										: wants.canBuy > 0
											? `can buy · ${wants.nextBuy}`
											: `cooling · ${wants.plan} in the Plan`
							}
						/>
					)}

					{shows("/keizoku") && (
						<Tile
							wide
							index={tile++}
							href="/keizoku"
							value={habits.length > 0 ? `${habits.length - left} / ${habits.length}` : null}
							note={
								habits.length === 0
									? "Nothing due today"
									: left === 0
										? "All done today"
										: `${left} left today`
							}
						>
							{habitList.length > 0 && (
								<Habits habits={habitList} today={data.habits?.today ?? today} />
							)}
							{habits.length > habitList.length && (
								<Link
									href="/keizoku"
									prefetch
									className="mt-1 inline-block text-xs text-muted-foreground transition-colors hover:text-foreground"
								>
									{habits.length - habitList.length} more
								</Link>
							)}
						</Tile>
					)}

					{shows("/tsundoku") && (
						<Tile
							wide
							index={tile++}
							href="/tsundoku"
							value={book ? `p. ${book.currentPage}` : null}
							note={
								book
									? [book.title, book.pageCount && `of ${book.pageCount}`]
											.filter(Boolean)
											.join(" · ")
									: "No book on the go"
							}
							action={
								book && (
									<TileAction label="Log pages" keys="P" onClick={() => setProgressBook(book)}>
										Log
									</TileAction>
								)
							}
						>
							{book && (
								<ProgressMeter
									compact
									currentPage={book.currentPage}
									pageCount={book.pageCount}
									daysToFinish={book.daysToFinish}
								/>
							)}
						</Tile>
					)}
				</div>
			)}

			{(fresh.length > 0 || hidden.length > 0) && (
				<StartHere apps={fresh} hidden={hidden} all={isNew} offset={isNew ? 1 : tile} />
			)}

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
