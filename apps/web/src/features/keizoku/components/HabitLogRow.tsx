"use client";

import { Spinner } from "@/components/Spinner";
import type { KeizokuHabit } from "@/features/keizoku/actions/habits";
import { archiveHabit } from "@/features/keizoku/actions/habits";
import type { KeizokuHabitLog } from "@/features/keizoku/actions/logs";
import { logHabit, unlogHabit } from "@/features/keizoku/actions/logs";
import { EditHabitModal } from "@/features/keizoku/components/EditHabitModal";
import { LogPhotoModal } from "@/features/keizoku/components/LogPhotoModal";
import { DAY_LABELS } from "@/features/keizoku/lib/constants";
import {
	Archive01Icon,
	ImageUpload01Icon,
	PencilEdit01Icon,
	Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

function frequencySubtitle(habit: KeizokuHabit): string {
	if (habit.frequencyType === "weekdays" && habit.frequencyDays?.length) {
		return habit.frequencyDays
			.slice()
			.sort((a, b) => a - b)
			.map((d) => DAY_LABELS[d])
			.join(", ");
	}
	if (habit.frequencyType === "times_per_week") {
		return `${habit.frequencyTarget}x / week`;
	}
	return "Every day";
}

export function HabitLogRow({
	habit,
	log,
	date,
	onChange,
}: {
	habit: KeizokuHabit;
	log: KeizokuHabitLog | null;
	date: string;
	onChange: () => void;
}) {
	const [pending, startTransition] = useTransition();
	const [photoModalOpen, setPhotoModalOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const done = log != null;

	function toggle() {
		if (done) {
			startTransition(async () => {
				const res = await unlogHabit(habit.id, date);
				if ("error" in res) toast.error(res.error);
				else onChange();
			});
			return;
		}
		const formData = new FormData();
		formData.set("habitId", habit.id);
		formData.set("date", date);
		startTransition(async () => {
			const res = await logHabit(formData);
			if ("error" in res) toast.error(res.error);
			else onChange();
		});
	}

	function handleArchive() {
		startTransition(async () => {
			const res = await archiveHabit(habit.id);
			if ("error" in res) toast.error(res.error);
			else {
				toast.success(`"${habit.name}" archived`);
				onChange();
			}
		});
	}

	return (
		<div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5">
			<button
				type="button"
				onClick={toggle}
				disabled={pending}
				className={cn(
					"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg transition-colors",
					done ? "bg-primary text-primary-foreground" : "bg-muted",
				)}
				aria-label={done ? "Mark not done" : "Mark done"}
			>
				{pending ? (
					<Spinner className="h-4 w-4" />
				) : done ? (
					<HugeiconsIcon icon={Tick02Icon} className="h-4 w-4" />
				) : (
					habit.emoji
				)}
			</button>

			<Link href={`/keizoku/${habit.id}`} className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{habit.name}</p>
				<p className="truncate text-xs text-muted-foreground">
					{frequencySubtitle(habit)}
					{habit.requiresPhoto && !log?.photoUrl && " · 📷 add a photo"}
				</p>
			</Link>

			{log?.photoUrl && (
				<img src={log.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
			)}

			<button
				type="button"
				onClick={() => setPhotoModalOpen(true)}
				className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
				aria-label="Add note or photo"
			>
				<HugeiconsIcon icon={ImageUpload01Icon} className="h-4 w-4" />
			</button>

			<button
				type="button"
				onClick={() => setEditOpen(true)}
				className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
				aria-label="Edit habit"
			>
				<HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4" />
			</button>

			<button
				type="button"
				onClick={handleArchive}
				disabled={pending}
				className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
				aria-label="Archive habit"
			>
				<HugeiconsIcon icon={Archive01Icon} className="h-4 w-4" />
			</button>

			<LogPhotoModal
				habit={habit}
				date={date}
				log={log}
				open={photoModalOpen}
				onOpenChange={setPhotoModalOpen}
				onChange={onChange}
			/>
			<EditHabitModal
				habit={habit}
				open={editOpen}
				onOpenChange={setEditOpen}
				onChange={onChange}
			/>
		</div>
	);
}
