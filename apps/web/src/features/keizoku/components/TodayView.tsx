"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ContextArea, openContextMenu } from "@/components/ContextArea";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { PageTitle } from "@/components/PageTitle";
import type { TodayHabit } from "@/features/keizoku/actions/logs";
import { DayNoteDialog, type DayNoteTarget } from "@/features/keizoku/components/DayNoteDialog";
import { FIGURES_ROW, Figure } from "@/features/keizoku/components/Figure";
import { HabitDialog } from "@/features/keizoku/components/HabitDialog";
import {
	DayLetter,
	HabitRow,
	ROW_GRID,
	RUN_COL,
	STRIP,
} from "@/features/keizoku/components/HabitRow";
import { formatDay } from "@/features/keizoku/lib/constants";
import { neighbourHabit, targetHabit } from "@/features/keizoku/lib/habit-nav";
import { editHabit, saveNote, setArchived, tickDay } from "@/features/keizoku/lib/offline";
import { overlayToday } from "@/features/keizoku/lib/overlay";
import { rate, runUnit, tally } from "@/features/keizoku/lib/streak";
import { usePendingOps } from "@/features/pwa/lib/use-outbox";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Archive01Icon,
	CheckmarkCircle02Icon,
	Note01Icon,
	PencilEdit01Icon,
	SidebarRightIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useOptimistic,
	useRef,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";

type Patch = { habitId: string; date: string; done: boolean } | { habitId: string; remove: true };

const FAILED = { error: "Couldn't save. Check your connection." };

function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today: the day at a glance, then each habit with its check and its week. */
export function TodayView({
	habits: server,
	today,
	heatmap,
}: {
	habits: TodayHabit[];
	today: string;
	/** The year of every habit, rendered by the page (see its note). */
	heatmap: React.ReactNode;
}) {
	const router = useRouter();
	const [, startTransition] = useTransition();
	const [editingId, setEditingId] = useState<{ id: string; instant: boolean } | null>(null);
	const [noteTarget, setNoteTarget] = useState<{ target: DayNoteTarget; instant: boolean } | null>(
		null,
	);
	const [clearing, setClearing] = useState<{ habitId: string; date: string } | null>(null);
	const [menuId, setMenuId] = useState<string | null>(null);

	// First visit before the tz cookie existed: the server guessed the day. If the browser's
	// day differs, store the zone (TimezoneSync may not have run yet) and re-render.
	useEffect(() => {
		if (localToday() === today) return;
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		document.cookie = `tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
		router.refresh();
	}, [today, router]);

	// Changes queued offline show until the server has them (lib/overlay.ts).
	const pending = usePendingOps("keizoku.");
	const saved = useMemo(() => overlayToday(server, pending, today), [server, pending, today]);
	const [habits, applyPatch] = useOptimistic(saved, (list, p: Patch) =>
		"remove" in p
			? list.filter((h) => h.habit.id !== p.habitId)
			: list.map((h) =>
					h.habit.id === p.habitId
						? {
								...h,
								days: h.days.map((d) =>
									d.date === p.date
										? { ...d, done: p.done, ...(p.done ? {} : { note: null, photoUrl: null }) }
										: d,
								),
							}
						: h,
				),
	);
	const find = (id: string) => habits.find((h) => h.habit.id === id);

	function run(patch: Patch, action: () => Promise<{ error: string } | { success: true }>) {
		startTransition(async () => {
			applyPatch(patch);
			const result = await action().catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
		});
	}

	// Stable for the memoised rows; reads the latest list through a ref.
	const habitsRef = useRef(habits);
	habitsRef.current = habits;
	const toggle = useCallback((habitId: string, date: string) => {
		const item = habitsRef.current.find((h) => h.habit.id === habitId);
		const day = item?.days.find((d) => d.date === date);
		if (!item || !day) return;
		if (!day.done) {
			run({ habitId, date, done: true }, () => tickDay(item.habit, date, true));
			return;
		}
		// Words or a picture go with the day: ask first.
		if (day.note || day.photoUrl) setClearing({ habitId, date });
		else run({ habitId, date, done: false }, () => tickDay(item.habit, date, false));
	}, []);

	function openNote(habitId: string, instant: boolean) {
		const item = find(habitId);
		if (!item) return;
		const day = item.days[item.days.length - 1];
		setNoteTarget({
			instant,
			target: {
				habitId,
				habitName: item.habit.name,
				emoji: item.habit.emoji,
				date: day.date,
				note: day.note,
				photoUrl: day.photoUrl,
			},
		});
	}

	function archive(habitId: string) {
		const item = find(habitId);
		if (!item) return;
		run({ habitId, remove: true }, async () => {
			const result = await setArchived(item.habit, true);
			if ("success" in result) {
				toast(`“${item.habit.name}” archived`, {
					action: {
						label: "Undo",
						onClick: () =>
							void setArchived(item.habit, false).then((r) => "error" in r && toast.error(r.error)),
					},
				});
			}
			return result;
		});
	}

	// ── Keys: on the habit in focus or under the pointer ──
	const keyRef = useRef<(key: string, e: KeyboardEvent) => boolean>(() => false);
	keyRef.current = (key, e) => {
		const el = targetHabit();
		const id = el?.dataset.habitId;
		if (!el || !id) return false;
		const item = find(id);
		if (!item) return false;
		const instant = !e.repeat;
		if (key === "x") toggle(id, item.days[item.days.length - 1].date);
		else if (key === "m") openNote(id, instant);
		else if (key === "e") setEditingId({ id, instant });
		else if (key === "a") archive(id);
		else if (key === ".") openContextMenu(el);
		else return false;
		return true;
	};
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k && keyRef.current(k, e)) {
				e.preventDefault();
				return;
			}
			if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
			if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
			if (!(e.target instanceof HTMLElement) || !e.target.closest("[data-habit-row]")) return;
			const from = targetHabit();
			const next = from && neighbourHabit(from, e.key === "ArrowDown");
			if (next) {
				e.preventDefault();
				next.focus();
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const due = habits.filter((h) => h.due);
	const notDue = habits.filter((h) => !h.due);
	const figures = useMemo(() => summarise(habits), [habits]);
	const week = habits[0]?.days ?? [];
	const editing = editingId ? (find(editingId.id)?.habit ?? null) : null;
	const menuItem = menuId ? find(menuId) : undefined;
	const clearingItem = clearing ? find(clearing.habitId) : undefined;

	return (
		<>
			<PageTitle title="Today" />
			<section
				aria-label="Today at a glance"
				className={`${FIGURES_ROW} md:grid-cols-[1.4fr_1fr_1fr]`}
			>
				<div className="col-span-2 md:col-span-1">
					<Figure
						lead
						index={0}
						label={`Today · ${formatDay(today)}`}
						value={figures.doneToday}
						of={figures.dueToday}
						note={
							figures.dueToday === 0
								? "Nothing due today"
								: figures.doneToday === figures.dueToday
									? "All done for today"
									: `${figures.dueToday - figures.doneToday} to go`
						}
					/>
				</div>
				<Figure
					index={1}
					label="Last 7 days"
					value={figures.week}
					suffix="%"
					note={
						figures.week == null
							? undefined
							: `${figures.weekDone} of ${figures.weekExpected} check-ins`
					}
				/>
				<Figure
					index={2}
					label={figures.run?.going === false ? "Best run" : "Longest run going"}
					value={figures.run?.n ?? 0}
					suffix={figures.run ? figures.run.unit : "days"}
					note={
						figures.run
							? `${figures.run.name}${figures.run.going ? "" : " · start a new one today"}`
							: undefined
					}
				/>
			</section>

			<ContextArea
				attr="data-habit-id"
				onTarget={(id) => {
					setMenuId(id);
					return true;
				}}
				onClose={() => setMenuId(null)}
				menu={
					menuItem && (
						<>
							<ContextMenuItem
								onSelect={() => {
									startNavigationProgress();
									router.push(`/keizoku/${menuItem.habit.id}`);
								}}
							>
								<HugeiconsIcon icon={SidebarRightIcon} />
								Open
								<ContextMenuShortcut>↵</ContextMenuShortcut>
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => toggle(menuItem.habit.id, today)}>
								<HugeiconsIcon icon={CheckmarkCircle02Icon} />
								{menuItem.days.at(-1)?.done ? "Not done today" : "Done today"}
								<ContextMenuShortcut>X</ContextMenuShortcut>
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => openNote(menuItem.habit.id, false)}>
								<HugeiconsIcon icon={Note01Icon} />
								Note & photo…
								<ContextMenuShortcut>M</ContextMenuShortcut>
							</ContextMenuItem>
							<ContextMenuItem
								onSelect={() => setEditingId({ id: menuItem.habit.id, instant: false })}
							>
								<HugeiconsIcon icon={PencilEdit01Icon} />
								Edit…
								<ContextMenuShortcut>E</ContextMenuShortcut>
							</ContextMenuItem>
							<ContextMenuSeparator />
							<ContextMenuItem onSelect={() => archive(menuItem.habit.id)}>
								<HugeiconsIcon icon={Archive01Icon} />
								Archive
								<ContextMenuShortcut>A</ContextMenuShortcut>
							</ContextMenuItem>
						</>
					)
				}
			>
				<div className="mt-10 animate-rise" style={{ "--i": 3 } as React.CSSProperties}>
					<div
						aria-hidden
						className={`${ROW_GRID} items-end gap-y-1 border-b border-(--head-rule) px-(--group-px) pb-2`}
					>
						<span />
						<h2 className="text-sm font-medium">Habits</h2>
						<span className={`${RUN_COL} text-[11px] text-muted-foreground`}>Run</span>
						<span className={STRIP}>
							{week.map((d) => (
								<span
									key={d.date}
									className={
										d.date === today
											? "text-center text-[11px] font-medium text-foreground"
											: "text-center text-[11px] text-muted-foreground"
									}
								>
									<DayLetter date={d.date} />
								</span>
							))}
						</span>
					</div>
					<ol aria-label="Due today" className="inset-group">
						{due.map((item, i) => (
							<HabitRow key={item.habit.id} item={item} index={i} onToggle={toggle} />
						))}
					</ol>
					{due.length === 0 && (
						<p className="py-6 text-sm text-muted-foreground">Nothing is due today.</p>
					)}

					{notDue.length > 0 && (
						<section aria-labelledby="keizoku-not-today" className="mt-8">
							<h2
								id="keizoku-not-today"
								className="border-b border-(--head-rule) px-(--head-inset) pb-2 text-sm font-medium text-muted-foreground"
							>
								Not due today
							</h2>
							<ol className="inset-group">
								{notDue.map((item, i) => (
									<HabitRow
										key={item.habit.id}
										item={item}
										index={due.length + i}
										onToggle={toggle}
									/>
								))}
							</ol>
						</section>
					)}
				</div>
			</ContextArea>

			<section
				aria-labelledby="keizoku-year"
				className="mt-12 animate-rise"
				style={{ "--i": 4 } as React.CSSProperties}
			>
				<h2 id="keizoku-year" className="mb-4 text-sm font-medium">
					The last year
				</h2>
				{heatmap}
			</section>

			<HabitDialog
				habit={editing}
				open={editing != null}
				instant={editingId?.instant}
				onOpenChange={(open) => !open && setEditingId(null)}
				onSave={async (values) => {
					if (!editing) return;
					const result = await editHabit(editing, values).catch(() => FAILED);
					return "error" in result ? result.error : undefined;
				}}
			/>
			<DayNoteDialog
				target={noteTarget?.target ?? null}
				instant={noteTarget?.instant}
				onOpenChange={(open) => !open && setNoteTarget(null)}
				onSave={async (data) => {
					// A note belongs to a done day: saving one checks the day in, cancelling leaves it be.
					const target = noteTarget?.target;
					const item = target && find(target.habitId);
					if (!target || !item) return;
					const day = item.days.find((d) => d.date === target.date);
					if (day && !day.done) {
						const checked = await tickDay(item.habit, target.date, true).catch(() => FAILED);
						if ("error" in checked) return checked.error;
					}
					const result = await saveNote(item.habit, data).catch(() => FAILED);
					return "error" in result ? result.error : undefined;
				}}
			/>
			<ConfirmDelete
				confirmLabel="Clear day"
				open={clearing != null}
				onOpenChange={(open) => !open && setClearing(null)}
				title={`Clear ${clearing ? formatDay(clearing.date) : "the day"}?`}
				description={`“${clearingItem?.habit.name ?? "This habit"}” won't count as done that day, and the day's note and photo are deleted.`}
				onConfirm={() => {
					if (!clearing) return;
					const { habitId, date } = clearing;
					return new Promise<void>((resolve) => {
						run({ habitId, date, done: false }, async () => {
							const habit = find(habitId)?.habit;
							const result = habit ? await tickDay(habit, date, false) : FAILED;
							resolve();
							return result;
						});
					});
				}}
			/>
		</>
	);
}

/** The figures, from the (optimistic) list: today's count, the week's rate, the best run going. */
function summarise(habits: TodayHabit[]) {
	const due = habits.filter((h) => h.due);
	const doneToday = due.filter((h) => h.days.at(-1)?.done).length;
	let weekDone = 0;
	let weekExpected = 0;
	for (const h of habits) {
		const days = h.days;
		const t = tally(
			h.habit,
			days.filter((d) => d.done).map((d) => d.date),
			days[0].date,
			days[days.length - 1].date,
			h.start,
		);
		weekDone += t.done;
		weekExpected += t.expected;
	}
	// The longest run going; with none going, the best one so far — a number to beat, not a zero.
	const going = habits.reduce<TodayHabit | null>(
		(top, h) => (h.streak.current > (top?.streak.current ?? 0) ? h : top),
		null,
	);
	const best = habits.reduce<TodayHabit | null>(
		(top, h) => (h.streak.best > (top?.streak.best ?? 0) ? h : top),
		null,
	);
	return {
		dueToday: due.length,
		doneToday,
		week: rate({ done: weekDone, expected: weekExpected }),
		weekDone,
		weekExpected,
		run: going
			? {
					n: going.streak.current,
					unit: runUnit(going.habit, going.streak.current),
					name: going.habit.name,
					going: true,
				}
			: best
				? {
						n: best.streak.best,
						unit: runUnit(best.habit, best.streak.best),
						name: best.habit.name,
						going: false,
					}
				: null,
	};
}
