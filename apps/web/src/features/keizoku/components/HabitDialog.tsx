"use client";

import { AutoHeight } from "@/components/AutoHeight";
import { Spinner } from "@/components/Spinner";
import type { KeizokuHabit } from "@/features/keizoku/actions/guard";
import {
	DAY_NAMES,
	EMOJI_PRESETS,
	FREQUENCY_LABELS,
	FREQUENCY_TYPES,
	type FrequencyType,
	TIME_OF_DAY_LABELS,
	TIME_OF_DAY_VALUES,
	type TimeOfDay,
	WEEK_ORDER,
} from "@/features/keizoku/lib/constants";
import type { HabitFormValues, HabitPatch } from "@/features/keizoku/lib/keizoku-schemas";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	cn,
} from "@seikatsu/ui";
import { useEffect, useId, useState, useTransition } from "react";

export const FOOTER =
	"mt-auto flex justify-end gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4";

type Form = {
	name: string;
	emoji: string;
	frequencyType: FrequencyType;
	frequencyDays: number[];
	frequencyTarget: number;
	timeOfDay: TimeOfDay;
};

const BLANK: Form = {
	name: "",
	emoji: EMOJI_PRESETS[0],
	frequencyType: "daily",
	frequencyDays: [1, 2, 3, 4, 5],
	frequencyTarget: 3,
	timeOfDay: "anytime",
};

function formOf(habit: KeizokuHabit | null): Form {
	if (!habit) return BLANK;
	return {
		name: habit.name,
		emoji: habit.emoji,
		frequencyType: habit.frequencyType,
		frequencyDays: habit.frequencyDays ?? BLANK.frequencyDays,
		frequencyTarget: habit.frequencyTarget ?? BLANK.frequencyTarget,
		timeOfDay: habit.timeOfDay,
	};
}

function valuesOf(form: Form): HabitFormValues {
	return {
		name: form.name.trim(),
		emoji: form.emoji.trim(),
		frequencyType: form.frequencyType,
		frequencyDays: form.frequencyType === "weekdays" ? form.frequencyDays : null,
		frequencyTarget: form.frequencyType === "times_per_week" ? form.frequencyTarget : null,
		timeOfDay: form.timeOfDay,
	};
}

/** What an edit changed, as the action takes it. */
function changesOf(habit: KeizokuHabit, form: Form): HabitPatch {
	const next = valuesOf(form);
	const before = valuesOf(formOf(habit));
	return Object.fromEntries(
		Object.entries(next).filter(
			([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k as keyof HabitFormValues]),
		),
	);
}

/** A row of equal choices with one chip that slides under the chosen one. */
function Segmented<T extends string | number>({
	labelledBy,
	options,
	value,
	onChange,
}: {
	labelledBy: string;
	options: readonly { value: T; label: string; title?: string }[];
	value: T;
	onChange: (value: T) => void;
}) {
	const index = options.findIndex((o) => o.value === value);
	return (
		<div
			role="radiogroup"
			aria-labelledby={labelledBy}
			className="relative grid rounded-md bg-surface p-0.5"
			style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
		>
			<span
				aria-hidden
				className="absolute inset-y-0.5 left-0.5 rounded bg-surface-2 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
				style={{
					width: `calc((100% - 0.25rem) / ${options.length})`,
					transform: `translateX(${Math.max(index, 0) * 100}%)`,
				}}
			/>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					role="radio"
					aria-checked={value === o.value}
					title={o.title}
					onClick={() => onChange(o.value)}
					className={cn(
						"relative h-9 rounded text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring max-sm:h-10",
						value === o.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
					)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

const CELL =
	"relative flex aspect-square w-full items-center justify-center rounded-md text-lg outline-none transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring";
const ON = "bg-surface-2 ring-2 ring-foreground/80 ring-offset-2 ring-offset-background";

/** 13 icons and a last cell to type or paste any other: two even rows of seven. */
function EmojiGrid({
	labelledBy,
	value,
	onChange,
}: { labelledBy: string; value: string; onChange: (emoji: string) => void }) {
	const preset = (EMOJI_PRESETS as readonly string[]).includes(value);
	return (
		<div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-7 gap-2">
			{EMOJI_PRESETS.map((e) => (
				<button
					key={e}
					type="button"
					role="radio"
					aria-checked={value === e}
					aria-label={e}
					onClick={() => onChange(e)}
					className={cn(CELL, value === e ? ON : "bg-surface hover:bg-surface-2")}
				>
					{e}
				</button>
			))}
			<input
				aria-label="Another icon: type or paste an emoji"
				value={preset ? "" : value}
				placeholder="+"
				maxLength={16}
				onChange={(ev) => {
					// The last character typed or pasted (an emoji may be several code units).
					const chars = [...new Intl.Segmenter().segment(ev.target.value)].map((s) => s.segment);
					const next = chars.at(-1) ?? "";
					onChange(next || EMOJI_PRESETS[0]);
				}}
				className={cn(
					CELL,
					"text-center placeholder:text-base placeholder:text-muted-foreground",
					!preset ? ON : "bg-surface hover:bg-surface-2",
				)}
			/>
		</div>
	);
}

/**
 * New habit, or an existing one's details. Opens on the current values each time; an edit
 * sends only what changed.
 */
export function HabitDialog({
	habit,
	open,
	onOpenChange,
	onSave,
	instant = false,
}: {
	/** null = a new habit. */
	habit: KeizokuHabit | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Resolves with an error message, or nothing when saved. */
	onSave: (values: HabitFormValues | HabitPatch) => Promise<string | undefined>;
	/** Opened by a key: no entrance motion. */
	instant?: boolean;
}) {
	const id = useId();
	const [form, setForm] = useState(() => formOf(habit));
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();
	const set = <K extends keyof Form>(key: K, value: Form[K]) =>
		setForm((f) => ({ ...f, [key]: value }));

	useEffect(() => {
		if (open) {
			setForm(formOf(habit));
			setError(null);
		}
	}, [open, habit]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const values = valuesOf(form);
		if (!values.name) return setError("Name the habit");
		if (values.frequencyType === "weekdays" && !values.frequencyDays?.length)
			return setError("Pick at least one day");
		const payload = habit ? changesOf(habit, form) : values;
		if (habit && Object.keys(payload).length === 0) return onOpenChange(false);
		startSave(async () => {
			const failed = await onSave(payload);
			if (failed) setError(failed);
			else onOpenChange(false);
		});
	}

	function toggleDay(day: number) {
		const days = form.frequencyDays.includes(day)
			? form.frequencyDays.filter((d) => d !== day)
			: [...form.frequencyDays, day];
		set("frequencyDays", days);
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className={cn(
					"sm:max-w-md max-sm:flex max-sm:flex-col",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
				onOpenAutoFocus={(e) => {
					// A new habit starts at its name; an edit doesn't pull the phone's keyboard up.
					e.preventDefault();
					if (!habit) document.getElementById(`${id}-name`)?.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>{habit ? "Edit Habit" : "New Habit"}</DialogTitle>
					<DialogDescription className="sr-only">
						The habit's name, icon, how often it's due and when in the day.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-name`}>Name</Label>
						<Input
							id={`${id}-name`}
							value={form.name}
							maxLength={100}
							autoComplete="off"
							placeholder="Drink 2 l of water"
							onChange={(e) => {
								set("name", e.target.value);
								setError(null);
							}}
						/>
					</div>

					<div className="space-y-2">
						<Label id={`${id}-icon`}>Icon</Label>
						<EmojiGrid
							labelledBy={`${id}-icon`}
							value={form.emoji}
							onChange={(v) => set("emoji", v)}
						/>
					</div>

					<div className="space-y-2">
						<Label id={`${id}-repeat`}>Repeats</Label>
						<Segmented
							labelledBy={`${id}-repeat`}
							options={FREQUENCY_TYPES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }))}
							value={form.frequencyType}
							onChange={(v) => {
								set("frequencyType", v);
								setError(null);
							}}
						/>
						<AutoHeight>
							{form.frequencyType === "weekdays" && (
								<div
									role="group"
									aria-label="Days"
									className="animate-swap grid grid-cols-7 gap-2 pt-2"
								>
									{WEEK_ORDER.map((d) => {
										const on = form.frequencyDays.includes(d);
										return (
											<button
												key={d}
												type="button"
												aria-pressed={on}
												onClick={() => {
													toggleDay(d);
													setError(null);
												}}
												className={cn(
													"h-9 rounded-md text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring max-sm:h-10",
													on
														? "bg-primary text-primary-foreground"
														: "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground",
												)}
											>
												{DAY_NAMES[d]}
											</button>
										);
									})}
								</div>
							)}
							{form.frequencyType === "times_per_week" && (
								<div className="animate-swap pt-2">
									<Segmented
										labelledBy={`${id}-repeat`}
										options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({
											value: n,
											label: String(n),
											title: n === 1 ? "Once a week" : `${n} times a week`,
										}))}
										value={form.frequencyTarget}
										onChange={(v) => set("frequencyTarget", v)}
									/>
								</div>
							)}
						</AutoHeight>
					</div>

					<div className="space-y-2">
						<Label id={`${id}-when`}>Usually</Label>
						<Segmented
							labelledBy={`${id}-when`}
							options={TIME_OF_DAY_VALUES.map((t) => ({ value: t, label: TIME_OF_DAY_LABELS[t] }))}
							value={form.timeOfDay}
							onChange={(v) => set("timeOfDay", v)}
						/>
						<p className="text-xs text-muted-foreground">Orders Today: morning habits first.</p>
					</div>

					{error && (
						<p role="alert" className="text-[0.8rem] text-destructive">
							{error}
						</p>
					)}
					<div className={FOOTER}>
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							disabled={isSaving}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" className="gap-1.5 max-sm:flex-1" disabled={isSaving}>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : habit ? "Save" : "Add Habit"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
