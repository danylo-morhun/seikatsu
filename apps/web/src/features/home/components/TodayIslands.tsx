"use client";

// The home's interactive bits. The page itself is a server component, so each tile can stream
// in on its own; these sit inside the tiles (and the header) once their data is there.

import { cn } from "@seikatsu/ui";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { type AppHref, LineAction } from "@/features/home/components/Line";
import { greeting } from "@/features/home/lib/format";
import type { BookToday, HabitToday } from "@/features/home/lib/today";
import { CheckButton } from "@/features/keizoku/components/HabitRow";
import { tickDay } from "@/features/keizoku/lib/offline";
import { usePendingOps } from "@/features/pwa/lib/use-outbox";
import { saveProgress as sendProgress } from "@/features/tsundoku/lib/offline";
import { useOpenedOnce } from "@/hooks/useOpenedOnce";
import { pageKey } from "@/lib/capture-shortcut";

// The tiles' dialogs load on first open; hovering their button starts it early.
const loadReading = () =>
	import("@/features/aisha/components/ReadingDialog").then((m) => m.ReadingDialog);
const loadProgress = () =>
	import("@/features/tsundoku/components/ProgressDialog").then((m) => m.ProgressDialog);
const ReadingDialog = dynamic(loadReading, { ssr: false });
const ProgressDialog = dynamic(loadProgress, { ssr: false });

/** "Good morning, Ann. " — by the reader's clock, which the server doesn't know. */
export function Greeting({ firstName }: { firstName: string | null }) {
	const [hour, setHour] = useState<number | null>(null);
	useEffect(() => setHour(new Date().getHours()), []);
	return hour != null && firstName ? `${greeting(hour)}, ${firstName}. ` : null;
}

/** 1–7 open the apps in sidebar order (set-aside ones skipped). P and M belong to their tiles;
 * N is the transaction dialog's. */
export function HomeKeys({ listed }: { listed: AppHref[] }) {
	const router = useRouter();
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const key = pageKey(e);
			const app = key && /^[1-7]$/.test(key) ? listed[Number(key) - 1] : undefined;
			if (!app) return;
			e.preventDefault();
			router.push(app);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router, listed]);
	return null;
}

/** A key that opens a tile's dialog, while that tile is on the page. */
function useTileKey(key: string, open: () => void) {
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (pageKey(e) !== key) return;
			e.preventDefault();
			open();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [key, open]);
}

export function HabitsToday({ habits: server, today }: { habits: HabitToday[]; today: string }) {
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

	// A day with a note or photo is cleared only after asking, as in Keizoku.
	const [clearing, setClearing] = useState<(typeof habits)[number] | null>(null);

	function save(h: (typeof habits)[number], done: boolean) {
		startTransition(async () => {
			setDone({ id: h.id, done });
			const result = await tickDay(h, today, done).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
		});
	}

	function toggle(h: (typeof habits)[number]) {
		if (h.done && h.kept) setClearing(h);
		else save(h, !h.done);
	}

	return (
		<>
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
			<ConfirmDelete
				confirmLabel="Clear day"
				open={clearing != null}
				onOpenChange={(open) => !open && setClearing(null)}
				title="Clear today?"
				description={`“${clearing?.name ?? "This habit"}” won't count as done today, and today's note and photo are deleted.`}
				onConfirm={async () => {
					if (clearing) save(clearing, false);
				}}
			/>
		</>
	);
}

/** Aisha's tile action: M, or the Log button, records the odometer. */
export function LogMileage({ vehicleId, currentKm }: { vehicleId: string; currentKm: number }) {
	const [open, setOpen] = useState(false);
	const mounted = useOpenedOnce(open);
	const openDialog = useCallback(() => setOpen(true), []);
	useTileKey("m", openDialog);
	return (
		<>
			<LineAction
				label="Log mileage"
				keys="M"
				onClick={openDialog}
				onPointerEnter={loadReading}
				onFocus={loadReading}
			>
				Log
			</LineAction>
			{mounted && (
				<ReadingDialog
					open={open}
					onOpenChange={setOpen}
					vehicleId={vehicleId}
					currentKm={currentKm}
				/>
			)}
		</>
	);
}

/** Tsundoku's tile action: P, or the Log button, logs pages of the book being read. */
export function LogPages({ book }: { book: BookToday }) {
	const [target, setTarget] = useState<BookToday | null>(null);
	const mounted = useOpenedOnce(target != null);
	const [, startTransition] = useTransition();
	const openDialog = useCallback(() => setTarget(book), [book]);
	useTileKey("p", openDialog);

	function save(bookId: string, page: number) {
		startTransition(async () => {
			const result = await sendProgress({ id: bookId, title: book.title }, page).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<>
			<LineAction
				label="Log pages"
				keys="P"
				onClick={openDialog}
				onPointerEnter={loadProgress}
				onFocus={loadProgress}
			>
				Log
			</LineAction>
			{mounted && (
				<ProgressDialog
					book={target}
					onOpenChange={(open) => !open && setTarget(null)}
					onSave={save}
				/>
			)}
		</>
	);
}
