import { getDueToday } from "@/features/keizoku/actions/logs";
import { HomeHabits } from "@/features/keizoku/components/HomeHabits";

/** The home card's check-in: today's due habits, each a tap away. Nothing due, nothing shown. */
export async function KeizokuHomeWidget() {
	const due = await getDueToday();
	if (due.length === 0) return null;
	return (
		<HomeHabits
			today={due[0].today}
			habits={due.map(({ habit, done }) => ({
				id: habit.id,
				name: habit.name,
				emoji: habit.emoji,
				done,
			}))}
		/>
	);
}
