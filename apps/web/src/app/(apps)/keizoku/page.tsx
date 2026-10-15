import { getTodayHabits } from "@/features/keizoku/actions/logs";
import { getActivity } from "@/features/keizoku/actions/stats";
import { Heatmap } from "@/features/keizoku/components/Heatmap";
import { KeizokuWelcome } from "@/features/keizoku/components/KeizokuWelcome";
import { TodayView } from "@/features/keizoku/components/TodayView";
import { activityText } from "@/features/keizoku/lib/constants";
import { addDays, mondayOf as weekStart } from "@/features/keizoku/lib/streak";
import { getUserToday } from "@/lib/timezone";

export default async function KeizokuPage() {
	const today = await getUserToday();
	const from = addDays(weekStart(today), -52 * 7);
	const [habits, activity] = await Promise.all([getTodayHabits(today), getActivity(from, today)]);
	const checkIns = activity.reduce((n, d) => n + d.done, 0);

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			{habits.length === 0 ? (
				<KeizokuWelcome />
			) : (
				<TodayView
					habits={habits}
					today={today}
					// Rendered here and handed down as a slot: the year of days never becomes a
					// prop of the list that re-renders on every tick.
					heatmap={
						<Heatmap
							from={from}
							to={today}
							anchor={today}
							today={today}
							days={activity.map((d) => ({ date: d.date, level: d.level, text: activityText(d) }))}
							label="Every habit, the last year"
							summary={`${checkIns} ${checkIns === 1 ? "check-in" : "check-ins"} in the last year`}
						/>
					}
				/>
			)}
		</div>
	);
}
