"use client";

import { checkDay, uncheckDay } from "@/features/keizoku/actions/logs";
import { CheckButton } from "@/features/keizoku/components/HabitRow";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

const HOME_LIMIT = 5;

interface HomeHabit {
	id: string;
	name: string;
	emoji: string;
	done: boolean;
}

/**
 * Today's habits on the seikatsu home: tick them without opening Keizoku. A day with a note
 * or photo is cleared from Keizoku itself, where the clear asks first.
 */
export function HomeHabits({ habits: saved, today }: { habits: HomeHabit[]; today: string }) {
	const [, startTransition] = useTransition();
	const [habits, setDone] = useOptimistic(saved, (list, p: { id: string; done: boolean }) =>
		list.map((h) => (h.id === p.id ? { ...h, done: p.done } : h)),
	);
	const done = habits.filter((h) => h.done).length;
	// The card stays a card: the first few still to do, then a count of the rest.
	const shown = [...habits.filter((h) => !h.done), ...habits.filter((h) => h.done)].slice(
		0,
		HOME_LIMIT,
	);
	const more = habits.length - shown.length;

	function toggle(h: HomeHabit) {
		startTransition(async () => {
			setDone({ id: h.id, done: !h.done });
			const result = await (h.done ? uncheckDay(h.id, today) : checkDay(h.id, today)).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<div className="relative z-10 mt-4">
			<p className="mb-1 text-xs text-muted-foreground">
				Today · <span className="font-figures">{done}</span> of{" "}
				<span className="font-figures">{habits.length}</span>
			</p>
			<ul className="divide-y divide-rule">
				{shown.map((h) => (
					<li key={h.id} className="flex items-center gap-2">
						<CheckButton
							done={h.done}
							label={`${h.name}: ${h.done ? "done today" : "mark done today"}`}
							onClick={() => toggle(h)}
							className="-ml-1.5"
						/>
						<span aria-hidden className="shrink-0">
							{h.emoji}
						</span>
						<span
							className={h.done ? "truncate text-sm text-muted-foreground" : "truncate text-sm"}
						>
							{h.name}
						</span>
					</li>
				))}
			</ul>
			{more > 0 && (
				<p className="mt-1 text-xs text-muted-foreground">
					and <span className="font-figures">{more}</span> more in Keizoku
				</p>
			)}
		</div>
	);
}
