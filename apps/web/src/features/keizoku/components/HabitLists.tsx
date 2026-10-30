"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { SettingsSection } from "@/components/SettingsSection";
import {
	type ArchivedHabit,
	type KeizokuHabit,
	deleteHabit,
} from "@/features/keizoku/actions/habits";
import { HabitDialog } from "@/features/keizoku/components/HabitDialog";
import { TIME_OF_DAY_LABELS, scheduleLabel } from "@/features/keizoku/lib/constants";
import { requestNewHabit } from "@/features/keizoku/lib/events";
import { editHabit, setArchived } from "@/features/keizoku/lib/offline";
import {
	Archive01Icon,
	ArchiveArrowUpIcon,
	Delete01Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

const FAILED = { error: "Couldn't save. Check your connection." };
const rise = (i: number) => ({ "--i": Math.min(i, 8) }) as CSSProperties;

const SINCE = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

function useRemovable<T extends { id: string }>(items: T[]) {
	return useOptimistic(items, (list, id: string) => list.filter((h) => h.id !== id));
}

/** Settings: the habits as a hairline list — schedule and time of day, edit or archive. */
export function SettingsHabits({ habits: saved }: { habits: KeizokuHabit[] }) {
	const [habits, remove] = useRemovable(saved);
	const [, startTransition] = useTransition();
	const [editing, setEditing] = useState<KeizokuHabit | null>(null);

	function archive(habit: KeizokuHabit) {
		startTransition(async () => {
			remove(habit.id);
			const result = await setArchived(habit, true).catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
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

	return (
		<SettingsSection
			title="Habits"
			description="Edit one to change its schedule or time of day; archiving keeps its history."
			action={
				<Button variant="outline" onClick={requestNewHabit} aria-keyshortcuts="N">
					New Habit
				</Button>
			}
		>
			{habits.length === 0 ? (
				<p className="py-4 text-sm text-muted-foreground">
					No habits yet.{" "}
					<button
						type="button"
						onClick={requestNewHabit}
						className="text-foreground underline-offset-2 hover:underline"
					>
						Add one
					</button>
				</p>
			) : (
				<ul className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
					{habits.map((h, i) => (
						<li key={h.id} className="flex animate-rise items-center gap-3 py-2.5" style={rise(i)}>
							<span aria-hidden className="w-6 shrink-0 text-center text-base">
								{h.emoji}
							</span>
							<Link
								href={`/keizoku/${h.id}`}
								prefetch={false}
								className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<span className="block truncate text-sm font-medium">{h.name}</span>
								<span className="block truncate text-xs text-muted-foreground">
									{scheduleLabel(h)} · {TIME_OF_DAY_LABELS[h.timeOfDay]}
								</span>
							</Link>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="shrink-0"
										aria-label={`${h.name} actions`}
									>
										<HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-44">
									<DropdownMenuItem onClick={() => setEditing(h)}>
										<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 size-4" />
										Edit…
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => archive(h)}>
										<HugeiconsIcon icon={Archive01Icon} className="mr-2 size-4" />
										Archive
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					))}
				</ul>
			)}

			<HabitDialog
				habit={editing}
				open={editing != null}
				onOpenChange={(open) => !open && setEditing(null)}
				onSave={async (values) => {
					if (!editing) return;
					const result = await editHabit(editing, values).catch(() => FAILED);
					return "error" in result ? result.error : undefined;
				}}
			/>
		</SettingsSection>
	);
}

/** The archive: habits put away with their history — restore one, or delete it for good. */
export function ArchivedHabits({ habits: saved }: { habits: ArchivedHabit[] }) {
	const [habits, remove] = useRemovable(saved);
	const [, startTransition] = useTransition();
	const [deleting, setDeleting] = useState<ArchivedHabit | null>(null);

	function restore(habit: ArchivedHabit) {
		startTransition(async () => {
			remove(habit.id);
			const result = await setArchived(habit, false).catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
		});
	}

	if (habits.length === 0) {
		return (
			<p className="py-4 text-sm text-muted-foreground">
				Nothing archived. Archiving a habit takes it off Today and keeps its history.
			</p>
		);
	}

	return (
		<>
			<ul className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
				{habits.map((h, i) => (
					<li key={h.id} className="flex animate-rise items-center gap-3 py-2.5" style={rise(i)}>
						<span aria-hidden className="w-6 shrink-0 text-center text-base">
							{h.emoji}
						</span>
						<Link
							href={`/keizoku/${h.id}`}
							prefetch={false}
							className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<span className="block truncate text-sm font-medium">{h.name}</span>
							<span className="block truncate text-xs text-muted-foreground">
								<span className="font-figures">{h.checkIns}</span>{" "}
								{h.checkIns === 1 ? "check-in" : "check-ins"}
								{h.archivedAt && ` · archived ${SINCE.format(h.archivedAt)}`}
							</span>
						</Link>
						<Button
							variant="outline"
							size="sm"
							className="shrink-0 gap-1.5"
							onClick={() => restore(h)}
						>
							<HugeiconsIcon icon={ArchiveArrowUpIcon} className="size-4" />
							Restore
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="shrink-0"
									aria-label={`${h.name} actions`}
								>
									<HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-44">
								<DropdownMenuItem onClick={() => restore(h)}>
									<HugeiconsIcon icon={ArchiveArrowUpIcon} className="mr-2 size-4" />
									Restore
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onClick={() => setDeleting(h)}
								>
									<HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
									Delete…
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</li>
				))}
			</ul>

			<ConfirmDelete
				open={deleting != null}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete “${deleting?.name ?? ""}”?`}
				description={
					deleting && deleting.checkIns > 0
						? `Its ${deleting.checkIns} ${deleting.checkIns === 1 ? "check-in goes" : "check-ins go"} with it, notes and photos included. This can't be undone.`
						: "It has no check-ins. This can't be undone."
				}
				onConfirm={async () => {
					if (!deleting) return;
					const id = deleting.id;
					const result = await deleteHabit(id).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</>
	);
}
