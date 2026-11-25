import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { Invite } from "@/features/day/components/Invite";
import { loadDay } from "@/features/day/lib/data";
import { WeekFocus } from "@/features/week/components/WeekFocus";
import { WeekPlanKey } from "@/features/week/components/WeekPlanKey";
import {
	focusStates,
	loadWeekRhythm,
	readDayPlans,
	readWeekPlan,
} from "@/features/week/lib/plan-data";
import { mondayOf } from "@/features/week/lib/rhythm";
import type { Money, WeekHabit } from "@/features/week/lib/week";
import type { ModuleHref } from "@/lib/modules";
import type { Workspace } from "@/lib/session";

/**
 * The week's rhythm over its calendar: the invite to plan it when that's due, else its focus,
 * and each day's own plan as a short note ("My day 2/3 · closed") for the day heads.
 */
export async function loadWeekRhythmParts(
	ws: Workspace,
	today: string,
	week: string[],
	money: Money,
	on: readonly ModuleHref[],
) {
	const viewed = week[0] ?? today;
	const [rhythm, dayPlans] = await Promise.all([
		on.includes("/week/plan") && viewed >= mondayOf(today)
			? loadWeekRhythm(ws, today, money)
			: null,
		on.includes("/day") ? readDayPlans(ws.id, week[0] ?? today, week[6] ?? today) : [],
	]);
	const viewedPlan =
		rhythm && viewed === mondayOf(today)
			? { plan: rhythm.current, focus: rhythm.focus }
			: on.includes("/week/plan") && viewed > today
				? await readWeekPlan(ws.id, viewed).then(async (plan) => ({
						plan,
						focus: plan?.plannedAt
							? await focusStates(ws, today, money, plan.focus, plan.ticked)
							: [],
					}))
				: null;
	const invite =
		rhythm?.phase === "plan" && (viewed === mondayOf(today) || viewed === rhythm.target)
			? rhythm
			: null;
	const live = week.includes(today) && on.includes("/day") ? await loadDay(ws, today, money) : null;
	const notes = new Map<string, string>();
	for (const d of dayPlans) {
		const result =
			d.day === today && live?.plan?.plannedAt
				? { done: live.picks.filter((p) => p.done).length, of: live.picks.length }
				: d.result;
		const parts = [
			result?.of ? `My day ${result.done}/${result.of}` : null,
			d.closedAt ? "closed" : null,
		];
		const note = parts.filter(Boolean).join(" · ");
		if (note) notes.set(d.day, note);
	}
	const focus =
		viewedPlan?.plan?.plannedAt && viewedPlan.focus.length > 0
			? {
					weekStart: viewed,
					focus: viewedPlan.focus,
					title: viewed === mondayOf(today) ? "This week's focus" : "Focus",
					canChange: viewed === rhythm?.target,
				}
			: null;
	return { invite, focus, notes, thisWeek: viewed === mondayOf(today) };
}

export type WeekRhythmParts = Awaited<ReturnType<typeof loadWeekRhythmParts>>;

/** The invite to plan the week, or its focus. */
export function WeekRhythmHead({ parts, today }: { parts: WeekRhythmParts; today: string }) {
	if (parts.invite) {
		const thisWeek = parts.invite.target === mondayOf(today);
		return (
			<div>
				<Invite
					href="/week/plan"
					eyebrow={thisWeek ? "This week" : "Next week"}
					title={thisWeek ? "Plan the week" : "Look back, plan next week"}
					note="How the days went, then up to three things in focus."
				/>
				<WeekPlanKey />
			</div>
		);
	}
	if (parts.focus) return <WeekFocus {...parts.focus} />;
	return null;
}

const WEEKDAY = ["M", "T", "W", "T", "F", "S", "S"];

/** Each habit as seven dots: filled when kept, a ring when it was due and missed. */
export function HabitWeek({ habits, today }: { habits: WeekHabit[]; today: string }) {
	if (habits.length === 0) return null;
	return (
		<section aria-label="Habits this week" className="theme-keizoku">
			<div className="group-card overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-[11px] text-muted-foreground">
							<th className="text-left font-normal">
								<Link href="/keizoku" prefetch className="hover:text-foreground">
									Habits
								</Link>
							</th>
							{WEEKDAY.map((letter, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: the seven weekdays, fixed
								<th key={i} className="w-7 text-center font-normal">
									{letter}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{habits.map((h) => (
							<tr key={h.id}>
								<td className="max-w-0 truncate py-1 pr-3">
									<span aria-hidden>{h.emoji}</span> {h.name}
								</td>
								{h.days.map((day) => (
									<td key={day.date} className="text-center">
										<span
											role="img"
											aria-label={`${day.date}: ${day.done ? "done" : day.scheduled && day.date < today ? "missed" : "open"}`}
											className={cn(
												"inline-block size-2.5 rounded-full",
												day.done
													? "bg-primary"
													: day.scheduled && day.date <= today
														? "ring-1 ring-primary/50 ring-inset"
														: "bg-muted-foreground/15",
											)}
										/>
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}
