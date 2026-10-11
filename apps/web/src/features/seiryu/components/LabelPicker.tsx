"use client";

import { Spinner } from "@/components/Spinner";
import { createLabel, setCardLabels } from "@/features/seiryu/actions/labels";
import { LABEL_COLORS } from "@/features/seiryu/lib/constants";
import type { LabelData } from "@/features/seiryu/lib/types";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, cn } from "@seikatsu/ui";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	cardId: string;
	projectId: string;
	projectLabels: LabelData[];
	cardLabels: LabelData[];
	onChange: (labels: LabelData[]) => void;
	onProjectLabelsChange?: (labels: LabelData[]) => void;
}

/** Kuroji's tag picker: toggle chips, and a field to make a new one on the spot. */
export function LabelPicker({
	cardId,
	projectId,
	projectLabels,
	cardLabels,
	onChange,
	onProjectLabelsChange,
}: Props) {
	const [selected, setSelected] = useState(() => new Set(cardLabels.map((l) => l.id)));
	const selectedRef = useRef(selected);
	const [newName, setNewName] = useState("");
	const [isCreating, startCreate] = useTransition();
	const inputId = useId();

	function apply(next: Set<string>, labels = projectLabels) {
		selectedRef.current = next;
		setSelected(next);
		onChange(labels.filter((l) => next.has(l.id)));
	}

	async function save(next: Set<string>, labels = projectLabels) {
		const before = selectedRef.current;
		apply(next, labels);
		const result = await setCardLabels({ cardId, labelIds: [...next] });
		if ("error" in result) {
			toast.error(result.error);
			apply(before, labels);
		}
	}

	function toggle(labelId: string) {
		const next = new Set(selectedRef.current);
		if (next.has(labelId)) next.delete(labelId);
		else next.add(labelId);
		save(next);
	}

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		const name = newName.trim();
		if (!name) return;
		const existing = projectLabels.find((l) => l.name.toLowerCase() === name.toLowerCase());
		if (existing) {
			setNewName("");
			if (!selectedRef.current.has(existing.id)) toggle(existing.id);
			return;
		}
		const color = LABEL_COLORS[projectLabels.length % LABEL_COLORS.length]?.hex ?? "#9d9790";
		startCreate(async () => {
			const result = await createLabel({ projectId, name, color });
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			setNewName("");
			const labels = [...projectLabels, { id: result.data.id, name, color }];
			onProjectLabelsChange?.(labels);
			await save(new Set([...selectedRef.current, result.data.id]), labels);
		});
	}

	return (
		<section aria-labelledby={`${inputId}-title`} className="space-y-3">
			<div className="flex items-baseline justify-between gap-3">
				<h3 id={`${inputId}-title`} className="text-sm font-medium">
					Labels
				</h3>
				{projectLabels.length > 0 && (
					<Link
						href="/settings/seiryu?section=labels"
						prefetch
						className="text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						Edit labels
					</Link>
				)}
			</div>
			{projectLabels.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{projectLabels.map((label) => {
						const isOn = selected.has(label.id);
						return (
							<button
								key={label.id}
								type="button"
								onClick={() => toggle(label.id)}
								aria-pressed={isOn}
								className={cn(
									"inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97]",
									isOn
										? "border-input bg-surface-2 text-foreground"
										: "border-rule text-muted-foreground hover:border-input hover:text-foreground",
								)}
							>
								<span
									aria-hidden
									className="size-1.5 rounded-full"
									style={{ backgroundColor: label.color }}
								/>
								{label.name}
							</button>
						);
					})}
				</div>
			)}
			<form onSubmit={handleCreate} className="flex gap-1.5">
				<label htmlFor={inputId} className="sr-only">
					New label
				</label>
				<Input
					id={inputId}
					value={newName}
					maxLength={100}
					autoComplete="off"
					onChange={(e) => setNewName(e.target.value)}
					placeholder="New label…"
				/>
				<Button
					type="submit"
					variant="outline"
					className="gap-1.5"
					disabled={isCreating || !newName.trim()}
				>
					{isCreating ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />}
					Label
				</Button>
			</form>
		</section>
	);
}
