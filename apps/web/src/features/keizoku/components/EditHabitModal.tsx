"use client";

import { Spinner } from "@/components/Spinner";
import type { KeizokuHabit } from "@/features/keizoku/actions/habits";
import { updateHabit } from "@/features/keizoku/actions/habits";
import { FrequencyPicker } from "@/features/keizoku/components/FrequencyPicker";
import {
	EMOJI_PRESETS,
	type FrequencyType,
	TIME_OF_DAY_LABELS,
	TIME_OF_DAY_VALUES,
	type TimeOfDay,
} from "@/features/keizoku/lib/constants";
import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	cn,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
	habit: KeizokuHabit;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onChange?: () => void;
}

export function EditHabitModal({ habit, open, onOpenChange, onChange }: Props) {
	const [saving, setSaving] = useState(false);
	const router = useRouter();

	const [name, setName] = useState(habit.name);
	const [emoji, setEmoji] = useState(habit.emoji);
	const [frequencyType, setFrequencyType] = useState<FrequencyType>(habit.frequencyType);
	const [frequencyDays, setFrequencyDays] = useState<number[]>(habit.frequencyDays ?? []);
	const [frequencyTarget, setFrequencyTarget] = useState(String(habit.frequencyTarget ?? 3));
	const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(habit.timeOfDay);
	const [requiresPhoto, setRequiresPhoto] = useState(habit.requiresPhoto);

	useEffect(() => {
		if (!open) return;
		setName(habit.name);
		setEmoji(habit.emoji);
		setFrequencyType(habit.frequencyType);
		setFrequencyDays(habit.frequencyDays ?? []);
		setFrequencyTarget(String(habit.frequencyTarget ?? 3));
		setTimeOfDay(habit.timeOfDay);
		setRequiresPhoto(habit.requiresPhoto);
	}, [open, habit]);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) {
			toast.error("Name is required");
			return;
		}
		setSaving(true);
		const res = await updateHabit(habit.id, {
			name: name.trim(),
			emoji,
			frequencyType,
			frequencyDays: frequencyType === "weekdays" ? frequencyDays : undefined,
			frequencyTarget:
				frequencyType === "times_per_week" ? Number.parseInt(frequencyTarget, 10) : undefined,
			timeOfDay,
			requiresPhoto,
		});
		setSaving(false);
		if ("error" in res) {
			toast.error(res.error);
			return;
		}
		toast.success("Saved.");
		onOpenChange(false);
		if (onChange) onChange();
		else router.refresh();
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Edit habit</DialogTitle>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="space-y-1.5">
						<Label>Name</Label>
						<Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
					</div>
					<div className="space-y-1.5">
						<Label>Icon</Label>
						<div className="flex flex-wrap gap-1.5">
							{EMOJI_PRESETS.map((e) => (
								<button
									key={e}
									type="button"
									onClick={() => setEmoji(e)}
									className={cn(
										"flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors",
										emoji === e
											? "bg-primary/15 ring-1 ring-primary/40"
											: "bg-muted hover:bg-muted/70",
									)}
								>
									{e}
								</button>
							))}
							<Input
								value={emoji}
								onChange={(ev) => setEmoji(ev.target.value)}
								className="h-9 w-14 text-center"
								maxLength={4}
							/>
						</div>
					</div>
					<FrequencyPicker
						frequencyType={frequencyType}
						frequencyDays={frequencyDays}
						frequencyTarget={frequencyTarget}
						onFrequencyTypeChange={setFrequencyType}
						onFrequencyDaysChange={setFrequencyDays}
						onFrequencyTargetChange={setFrequencyTarget}
					/>
					<div className="space-y-1.5">
						<Label>Time of day</Label>
						<Select value={timeOfDay} onValueChange={(v) => setTimeOfDay(v as TimeOfDay)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIME_OF_DAY_VALUES.map((t) => (
									<SelectItem key={t} value={t}>
										{TIME_OF_DAY_LABELS[t]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<label htmlFor="edit-habit-requires-photo" className="flex items-center gap-2 text-sm">
						<Checkbox
							id="edit-habit-requires-photo"
							checked={requiresPhoto}
							onCheckedChange={(v) => setRequiresPhoto(v === true)}
						/>
						Prompt for a photo when logging
					</label>
					<div className="flex justify-end gap-2 pt-1">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving} className="gap-1.5">
							{saving && <Spinner />}
							{saving ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
