"use client";

import type { KeizokuHabit } from "@/features/keizoku/actions/habits";
import { archiveHabit, unarchiveHabit } from "@/features/keizoku/actions/habits";
import type { KeizokuHabitLog } from "@/features/keizoku/actions/logs";
import { EditHabitModal } from "@/features/keizoku/components/EditHabitModal";
import { HabitCalendarGrid } from "@/features/keizoku/components/HabitCalendarGrid";
import { StreakBadge } from "@/features/keizoku/components/StreakBadge";
import type { StreakResult } from "@/features/keizoku/lib/streak";
import { Archive01Icon, ArrowLeft01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	habit: KeizokuHabit;
	logs: KeizokuHabitLog[];
	streak: StreakResult;
	completionRate: number;
}

export function HabitDetailView({ habit, logs, streak, completionRate }: Props) {
	const router = useRouter();
	const [editOpen, setEditOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function toggleArchive() {
		startTransition(async () => {
			const res = habit.archivedAt ? await unarchiveHabit(habit.id) : await archiveHabit(habit.id);
			if ("error" in res) toast.error(res.error);
			else {
				toast.success(habit.archivedAt ? "Restored" : "Archived");
				router.refresh();
			}
		});
	}

	return (
		<main className="mx-auto max-w-3xl px-4 py-6 pb-24">
			<Link
				href="/keizoku"
				className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5" />
				Today
			</Link>

			<div className="mb-5 flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
						{habit.emoji}
					</span>
					<div className="min-w-0">
						<h1 className="truncate text-lg font-semibold">{habit.name}</h1>
						<p className="truncate text-xs text-muted-foreground">
							{completionRate}% completion · last 30 days
						</p>
					</div>
				</div>
				<div className="flex shrink-0 gap-1.5">
					<Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
						<HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4" />
					</Button>
					<Button variant="outline" size="sm" disabled={pending} onClick={toggleArchive}>
						<HugeiconsIcon icon={Archive01Icon} className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div className="mb-6">
				<StreakBadge current={streak.current} best={streak.best} />
			</div>

			<HabitCalendarGrid habit={habit} logs={logs} />

			<EditHabitModal habit={habit} open={editOpen} onOpenChange={setEditOpen} />
		</main>
	);
}
