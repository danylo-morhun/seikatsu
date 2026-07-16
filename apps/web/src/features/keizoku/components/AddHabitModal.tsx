"use client";

import { Spinner } from "@/components/Spinner";
import { createHabit } from "@/features/keizoku/actions/habits";
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
	DialogTrigger,
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
import { useState } from "react";
import { toast } from "sonner";

export function AddHabitModal({
	workspaceId,
	trigger,
	onChange,
}: {
	workspaceId: string;
	trigger: React.ReactNode;
	onChange?: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const router = useRouter();

	const [name, setName] = useState("");
	const [emoji, setEmoji] = useState("🎯");
	const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
	const [frequencyDays, setFrequencyDays] = useState<number[]>([]);
	const [frequencyTarget, setFrequencyTarget] = useState("3");
	const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("anytime");
	const [requiresPhoto, setRequiresPhoto] = useState(false);

	function reset() {
		setName("");
		setEmoji("🎯");
		setFrequencyType("daily");
		setFrequencyDays([]);
		setFrequencyTarget("3");
		setTimeOfDay("anytime");
		setRequiresPhoto(false);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) {
			toast.error("Name is required");
			return;
		}
		setSaving(true);
		const res = await createHabit(workspaceId, {
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
		toast.success("Habit created.");
		reset();
		setOpen(false);
		if (onChange) onChange();
		else router.refresh();
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) reset();
			}}
		>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>New habit</DialogTitle>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="space-y-1.5">
						<Label>Name</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							autoFocus
							placeholder="e.g. Morning run"
						/>
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
					<label htmlFor="add-habit-requires-photo" className="flex items-center gap-2 text-sm">
						<Checkbox
							id="add-habit-requires-photo"
							checked={requiresPhoto}
							onCheckedChange={(v) => setRequiresPhoto(v === true)}
						/>
						Prompt for a photo when logging
					</label>
					<div className="flex justify-end gap-2 pt-1">
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving} className="gap-1.5">
							{saving && <Spinner />}
							{saving ? "Saving…" : "Create"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
