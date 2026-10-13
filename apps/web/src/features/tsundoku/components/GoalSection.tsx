"use client";

import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import { clearGoal, setGoal } from "@/features/tsundoku/actions/goals";
import { BAR_FILL, barClip } from "@/lib/bar";
import { Button, Input, cn } from "@seikatsu/ui";
import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	year: number;
	target: number | null;
	booksRead: number;
	/** How much of the year has passed, 0–1 (1 for past years). */
	yearShare: number;
}

/**
 * The year's goal as a capacity bar that fills toward the target, with the pace in words:
 * where the reading stands against where it would be by now at an even pace.
 */
export function GoalSection({ year, target: saved, booksRead, yearShare }: Props) {
	const id = useId();
	const [target, setTarget] = useOptimistic(saved);
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState("");
	const [isSaving, startSave] = useTransition();

	function open() {
		setValue(target?.toString() ?? "");
		setEditing(true);
	}

	function save(e: React.FormEvent) {
		e.preventDefault();
		const targetBooks = Number.parseInt(value, 10);
		if (!(targetBooks > 0)) return;
		startSave(async () => {
			setTarget(targetBooks);
			const result = await setGoal({ year, targetBooks }).catch(() => ({
				error: "Couldn't save the goal.",
			}));
			if ("error" in result) toast.error(result.error);
			else setEditing(false);
		});
	}

	function remove() {
		startSave(async () => {
			setTarget(null);
			const result = await clearGoal(year).catch(() => ({ error: "Couldn't remove the goal." }));
			if ("error" in result) toast.error(result.error);
			setEditing(false);
		});
	}

	const reached = target != null && booksRead >= target;
	const expected = target != null ? target * yearShare : 0;
	const gap = Math.round(booksRead - expected);
	const pace =
		target == null || reached
			? null
			: yearShare >= 1
				? `${target - booksRead} short`
				: gap > 0
					? `${gap} ahead of pace`
					: gap < 0
						? `${-gap} behind pace`
						: "on pace";

	return (
		<section aria-labelledby={`${id}-title`}>
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h2 id={`${id}-title`} className="text-sm font-medium">
					Goal
				</h2>
				{target != null && !editing && (
					<button
						type="button"
						onClick={open}
						className="text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						Change
					</button>
				)}
			</div>

			{editing ? (
				<form onSubmit={save} className="animate-swap flex flex-wrap items-center gap-2">
					<label htmlFor={`${id}-target`} className="sr-only">
						Books to read in {year}
					</label>
					<Input
						id={`${id}-target`}
						autoFocus
						value={value}
						inputMode="numeric"
						maxLength={4}
						placeholder="24"
						className="w-24 font-figures"
						onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.stopPropagation();
								setEditing(false);
							}
						}}
					/>
					<span className="text-sm text-muted-foreground">books in {year}</span>
					<div className="ml-auto flex gap-2">
						{saved != null && (
							<Button type="button" variant="ghost" onClick={remove} disabled={isSaving}>
								Remove goal
							</Button>
						)}
						<Button type="submit" className="gap-1.5" disabled={isSaving || !(Number(value) > 0)}>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			) : target == null ? (
				<QuietAdd onClick={open}>Set a goal for {year}</QuietAdd>
			) : (
				<div className="flex items-center gap-3">
					<span aria-hidden className="relative h-1 flex-1 rounded-full bg-surface-2">
						<span
							className={cn(
								"absolute inset-0 rounded-full",
								BAR_FILL,
								reached ? "bg-positive" : "bg-primary/80",
							)}
							style={barClip(booksRead / target)}
						/>
					</span>
					<span className="shrink-0 font-figures text-xs text-muted-foreground">
						{reached ? `Goal of ${target} reached` : `${booksRead} of ${target}`}
						{pace && ` · ${pace}`}
					</span>
				</div>
			)}
		</section>
	);
}
