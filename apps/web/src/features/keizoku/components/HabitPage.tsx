"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { type KeizokuHabit, deleteHabit } from "@/features/keizoku/actions/habits";
import type { DayCell } from "@/features/keizoku/actions/logs";
import type { HabitSummary } from "@/features/keizoku/actions/stats";
import { DayNoteDialog, type DayNoteTarget } from "@/features/keizoku/components/DayNoteDialog";
import { FIGURES_ROW, Figure } from "@/features/keizoku/components/Figure";
import { HabitDialog } from "@/features/keizoku/components/HabitDialog";
import { CheckButton } from "@/features/keizoku/components/HabitRow";
import { type HeatDay, Heatmap } from "@/features/keizoku/components/Heatmap";
import { Photo } from "@/features/keizoku/components/Photo";
import { formatDay } from "@/features/keizoku/lib/constants";
import { TIME_OF_DAY_LABELS, scheduleLabel } from "@/features/keizoku/lib/constants";
import { editHabit, saveNote, setArchived, tickDay } from "@/features/keizoku/lib/offline";
import { overlayDays } from "@/features/keizoku/lib/overlay";
import {
	addDays,
	isScheduled,
	runUnit,
	mondayOf as weekStart,
} from "@/features/keizoku/lib/streak";
import { usePendingOps } from "@/features/pwa/lib/use-outbox";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Archive01Icon,
	ArchiveArrowUpIcon,
	ArrowLeft01Icon,
	Delete01Icon,
	MoreHorizontalIcon,
	Note01Icon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type CSSProperties,
	useEffect,
	useMemo,
	useOptimistic,
	useRef,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";

const FAILED = { error: "Couldn't save. Check your connection." };
const rise = (i: number) => ({ "--i": i }) as CSSProperties;
const SINCE = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

type Patch = { date: string; done: boolean };

interface Props {
	habit: KeizokuHabit;
	summary: HabitSummary;
	/** Done days of the calendar's year, newest first. */
	days: DayCell[];
	journal: DayCell[];
	today: string;
}

/** One habit: today's check, its figures, the year (tap a day to fill it in), what it remembers. */
export function HabitPage({ habit, summary, days: server, journal, today }: Props) {
	const router = useRouter();
	const [, startTransition] = useTransition();
	const [menuOpen, setMenuOpen] = useState(false);
	const [editing, setEditing] = useState<{ open: boolean; instant: boolean }>({
		open: false,
		instant: false,
	});
	const [noteTarget, setNoteTarget] = useState<{ target: DayNoteTarget; instant: boolean } | null>(
		null,
	);
	const [clearing, setClearing] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const archived = habit.archivedAt != null;

	// Changes queued offline show until the server has them (lib/overlay.ts).
	const pending = usePendingOps("keizoku.");
	const saved = useMemo(() => overlayDays(server, habit.id, pending), [server, habit.id, pending]);
	const [days, applyPatch] = useOptimistic(saved, (list, p: Patch) =>
		p.done
			? [{ date: p.date, done: true, note: null, photoUrl: null }, ...list]
			: list.filter((d) => d.date !== p.date),
	);
	const done = useMemo(() => new Set(days.map((d) => d.date)), [days]);
	const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
	const doneToday = done.has(today);

	function run(patch: Patch, action: () => Promise<{ error: string } | { success: true }>) {
		startTransition(async () => {
			applyPatch(patch);
			const result = await action().catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
		});
	}

	const toggleRef = useRef<(date: string) => void>(() => {});
	toggleRef.current = (date) => {
		const day = byDate.get(date);
		if (!day) run({ date, done: true }, () => tickDay(habit, date, true));
		else if (day.note || day.photoUrl) setClearing(date);
		else run({ date, done: false }, () => tickDay(habit, date, false));
	};
	// Stable for the memoised calendar.
	const [onToggle] = useState(() => (date: string) => toggleRef.current(date));

	function openNote(date: string, instant = false) {
		const day = byDate.get(date);
		setNoteTarget({
			instant,
			target: {
				habitId: habit.id,
				habitName: habit.name,
				emoji: habit.emoji,
				date,
				note: day?.note ?? null,
				photoUrl: day?.photoUrl ?? null,
			},
		});
	}

	function toggleArchive() {
		startTransition(async () => {
			const result = await setArchived(habit, !archived).catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
			else if (archived) toast(`“${habit.name}” is back on Today`);
			else
				toast(`“${habit.name}” archived`, {
					action: {
						label: "Undo",
						onClick: () =>
							void setArchived(habit, false).then((r) => "error" in r && toast.error(r.error)),
					},
				});
		});
	}

	const keyRef = useRef<(key: string, e: KeyboardEvent) => boolean>(() => false);
	keyRef.current = (key, e) => {
		if (key === "x" && !archived) onToggle(today);
		else if (key === "m" && !archived) openNote(today, !e.repeat);
		else if (key === "e") setEditing({ open: true, instant: true });
		else if (key === "a") toggleArchive();
		else if (key === ".") setMenuOpen(true);
		else if (key === "delete") setConfirmDelete(true);
		else return false;
		return true;
	};
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k && keyRef.current(k, e)) e.preventDefault();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// A year of weeks for the map: done is full pigment, a missed due day the empty cell, days
	// off-schedule or before the habit began quieter still.
	const yearFrom = addDays(weekStart(today), -52 * 7);
	const heat = useMemo<HeatDay[]>(() => {
		const out: HeatDay[] = [];
		for (let d = yearFrom; d <= today; d = addDays(d, 1)) {
			const isDone = done.has(d);
			const counted = d >= summary.start && d <= summary.end;
			const due = counted && (isScheduled(habit, d) || habit.frequencyType === "times_per_week");
			out.push({
				date: d,
				level: isDone ? 4 : due ? 0 : null,
				text: `${formatDay(d)} · ${isDone ? "done" : due ? "not done" : d < summary.start ? "before it began" : "not due"}`,
			});
		}
		return out;
	}, [done, habit, summary.start, summary.end, today, yearFrom]);
	const heatDone = heat.filter((d) => d.level === 4).length;
	const { streak } = summary;
	const weekly = habit.frequencyType === "times_per_week";
	const target = habit.frequencyTarget ?? 1;
	const thisWeekCount = [...done].filter((d) => d >= weekStart(today) && d <= today).length;
	// What to do next, never contradicting the check beside it.
	const runNote = archived
		? undefined
		: weekly
			? `${Math.min(thisWeekCount, target)} of ${target} this week`
			: streak.current === 0 && !doneToday
				? "Check it in today to start one"
				: undefined;
	const unit = (n: number) => runUnit(habit, n);

	return (
		<div className="px-4 pt-5 pb-28 sm:px-8 md:pb-10">
			<div className="mb-6 flex items-center justify-between gap-4">
				<Link
					href={archived ? "/keizoku/archive" : "/keizoku"}
					prefetch
					className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden className="size-4 shrink-0" />
					{archived ? "Archive" : "Today"}
				</Link>
				<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" aria-label="Habit actions" aria-keyshortcuts=".">
							<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						{!archived && (
							<DropdownMenuItem onClick={() => openNote(today)}>
								<HugeiconsIcon icon={Note01Icon} className="mr-2 h-4 w-4" />
								Today's note & photo…
								<DropdownMenuShortcut>M</DropdownMenuShortcut>
							</DropdownMenuItem>
						)}
						<DropdownMenuItem onClick={() => setEditing({ open: true, instant: false })}>
							<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
							Edit…
							<DropdownMenuShortcut>E</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuItem onClick={toggleArchive}>
							<HugeiconsIcon
								icon={archived ? ArchiveArrowUpIcon : Archive01Icon}
								className="mr-2 h-4 w-4"
							/>
							{archived ? "Restore" : "Archive"}
							<DropdownMenuShortcut>A</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={() => setConfirmDelete(true)}
						>
							<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
							Delete…
							<DropdownMenuShortcut>⌫</DropdownMenuShortcut>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<header className="flex animate-rise items-center gap-3">
				{!archived && (
					<CheckButton
						done={doneToday}
						label={doneToday ? "Done today — clear" : "Mark done today"}
						onClick={() => onToggle(today)}
					/>
				)}
				<div className="min-w-0">
					<h1 className="flex items-center gap-2 text-[1.75rem] leading-tight font-bold tracking-tight">
						<span aria-hidden className="shrink-0">
							{habit.emoji}
						</span>
						<span className="min-w-0 break-words">{habit.name}</span>
					</h1>
					<p className="mt-0.5 truncate text-sm text-muted-foreground">
						{[
							scheduleLabel(habit),
							TIME_OF_DAY_LABELS[habit.timeOfDay],
							`since ${SINCE.format(new Date(`${summary.start}T00:00:00Z`))}`,
							archived && "archived",
						]
							.filter(Boolean)
							.join(" · ")}
					</p>
				</div>
			</header>

			<section
				aria-label="Figures"
				className={`${FIGURES_ROW} mt-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]`}
			>
				<div className="col-span-2 md:col-span-1">
					<Figure
						lead
						index={1}
						label={archived ? "Last run" : "Current run"}
						value={streak.current}
						suffix={unit(streak.current)}
						note={runNote}
					/>
				</div>
				<Figure index={2} label="Best run" value={streak.best} suffix={unit(streak.best)} />
				<Figure index={3} label="Last 30 days" value={summary.rate30} suffix="%" />
				<div className="col-span-2 md:col-span-1">
					<Figure
						index={4}
						label="Check-ins"
						value={summary.total}
						note={summary.total > 0 ? "all time" : undefined}
					/>
				</div>
			</section>

			<section aria-labelledby="habit-year" className="mt-10 animate-rise" style={rise(5)}>
				<div className="mb-3 flex items-baseline justify-between gap-3">
					<h2 id="habit-year" className="text-sm font-medium">
						The last year
					</h2>
					<span className="text-xs text-muted-foreground">
						{archived ? "" : "Tap a day to fill it in"}
					</span>
				</div>
				<Heatmap
					from={yearFrom}
					to={today}
					anchor={today}
					today={today}
					days={heat}
					label={`${habit.name}: the last year`}
					summary={`${heatDone} ${heatDone === 1 ? "check-in" : "check-ins"} in the last year`}
					onToggle={archived ? undefined : onToggle}
				/>
			</section>

			<section aria-labelledby="habit-journal" className="mt-10 animate-rise" style={rise(6)}>
				<h2 id="habit-journal" className="mb-3 text-sm font-medium">
					Notes & photos
				</h2>
				{journal.length === 0 ? (
					<p className="py-6 text-sm text-muted-foreground">
						Nothing written yet. A done day can carry a note or a photo — press M for today's.
					</p>
				) : (
					<ul className="inset-group rounded-2xl bg-surface px-4 py-1 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent">
						{journal.map((d) => (
							<li key={d.date}>
								<button
									type="button"
									disabled={archived}
									onClick={() => openNote(d.date)}
									className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 rounded-md py-3 text-left outline-none transition-colors enabled:hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring md:-mx-2 md:w-[calc(100%+1rem)] md:px-2"
								>
									<span className="min-w-0">
										<span className="block text-xs text-muted-foreground">{formatDay(d.date)}</span>
										{d.note ? (
											<span className="mt-0.5 line-clamp-4 block text-sm whitespace-pre-wrap break-words">
												{d.note}
											</span>
										) : (
											<span className="mt-0.5 block text-sm text-muted-foreground">Photo</span>
										)}
									</span>
									{d.photoUrl && <Photo src={d.photoUrl} className="size-14 shrink-0 rounded-md" />}
								</button>
							</li>
						))}
					</ul>
				)}
			</section>

			<HabitDialog
				habit={habit}
				open={editing.open}
				instant={editing.instant}
				onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
				onSave={async (values) => {
					const result = await editHabit(habit, values).catch(() => FAILED);
					return "error" in result ? result.error : undefined;
				}}
			/>
			<DayNoteDialog
				target={noteTarget?.target ?? null}
				instant={noteTarget?.instant}
				onOpenChange={(open) => !open && setNoteTarget(null)}
				onSave={async (data) => {
					// A note belongs to a done day: saving one checks the day in, cancelling leaves it be.
					const date = noteTarget?.target.date;
					if (date && !byDate.has(date)) {
						const checked = await tickDay(habit, date, true).catch(() => FAILED);
						if ("error" in checked) return checked.error;
					}
					const result = await saveNote(habit, data).catch(() => FAILED);
					return "error" in result ? result.error : undefined;
				}}
			/>
			<ConfirmDelete
				confirmLabel="Clear day"
				open={clearing != null}
				onOpenChange={(open) => !open && setClearing(null)}
				title={`Clear ${clearing ? formatDay(clearing) : "the day"}?`}
				description="It won't count as done, and the day's note and photo are deleted."
				onConfirm={() => {
					if (!clearing) return;
					const date = clearing;
					return new Promise<void>((resolve) =>
						run({ date, done: false }, async () => {
							const result = await tickDay(habit, date, false);
							resolve();
							return result;
						}),
					);
				}}
			/>
			<ConfirmDelete
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Delete “${habit.name}”?`}
				description={
					summary.total > 0
						? `Its ${summary.total} ${summary.total === 1 ? "check-in goes" : "check-ins go"} with it, notes and photos included. Archive it instead to keep the history.`
						: "It has no check-ins yet."
				}
				onConfirm={async () => {
					const result = await deleteHabit(habit.id).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
					else router.replace(archived ? "/keizoku/archive" : "/keizoku");
				}}
			/>
		</div>
	);
}
