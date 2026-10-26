"use client";

import { AppWelcome } from "@/components/AppWelcome";
import { Spinner } from "@/components/Spinner";
import { createHabit } from "@/features/keizoku/actions/habits";
import { requestNewHabit } from "@/features/keizoku/lib/events";
import type { HabitFormValues } from "@/features/keizoku/lib/keizoku-schemas";
import { Button, cn } from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const STEPS = [
	{
		title: "Name a few habits",
		body: "Every day, on some days, or a number of times a week. Press N anywhere.",
	},
	{
		title: "Tick them off",
		body: "One tap a day. Forgot yesterday? Tap that day in the week beside it.",
	},
	{
		title: "Watch the thread",
		body: "Runs, the week and the year add themselves up. A missed day doesn't end the year.",
	},
];

/** Common first habits: picked here, each can be renamed or rescheduled later. */
const STARTERS: HabitFormValues[] = [
	{ name: "Read 20 minutes", emoji: "📖", frequencyType: "daily", timeOfDay: "evening" },
	{ name: "Walk", emoji: "🚶", frequencyType: "daily", timeOfDay: "anytime" },
	{ name: "Drink water", emoji: "💧", frequencyType: "daily", timeOfDay: "anytime" },
	{ name: "Stretch", emoji: "🧘", frequencyType: "daily", timeOfDay: "morning" },
	{
		name: "Work out",
		emoji: "🏋️",
		frequencyType: "times_per_week",
		frequencyTarget: 3,
		timeOfDay: "anytime",
	},
	{ name: "Journal", emoji: "✍️", frequencyType: "daily", timeOfDay: "evening" },
];

/** First run: no habits yet. Pick a few common ones in a tap, or write your own. */
export function KeizokuWelcome() {
	const [picked, setPicked] = useState<string[]>([]);
	const [isSaving, startSave] = useTransition();

	function toggle(name: string) {
		setPicked((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]));
	}

	function start() {
		startSave(async () => {
			for (const habit of STARTERS.filter((s) => picked.includes(s.name))) {
				const result = await createHabit(habit);
				if ("error" in result) {
					toast.error(result.error);
					return;
				}
			}
		});
	}

	return (
		<AppWelcome
			app="/keizoku"
			title="Small things, carried on."
			lead="継続 — continuing. Keizoku keeps the habits you want to keep, a day at a time, and lets you fill in the days you forgot. Pick a few to start with, or write your own."
			steps={STEPS}
		>
			<div className="flex max-w-lg flex-wrap gap-1.5">
				{STARTERS.map((s) => {
					const on = picked.includes(s.name);
					return (
						<Button
							key={s.name}
							type="button"
							variant="outline"
							size="sm"
							aria-pressed={on}
							onClick={() => toggle(s.name)}
							className={cn(on && "border-primary bg-primary/10 text-foreground")}
						>
							<span aria-hidden>{s.emoji}</span>
							{s.name}
						</Button>
					);
				})}
			</div>
			<div className="mt-5 flex flex-wrap gap-2">
				<Button onClick={start} disabled={isSaving || picked.length === 0} className="gap-1.5">
					{isSaving && <Spinner />}
					{isSaving
						? "Adding…"
						: picked.length === 0
							? "Start"
							: picked.length === 1
								? "Start with this one"
								: `Start with these ${picked.length}`}
				</Button>
				<Button variant="ghost" onClick={requestNewHabit} aria-keyshortcuts="N">
					Write your own
				</Button>
			</div>
		</AppWelcome>
	);
}
