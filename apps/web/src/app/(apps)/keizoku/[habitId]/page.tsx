import { getOwnedHabit } from "@/features/keizoku/actions/guard";
import { getHabitDays, getHabitJournal } from "@/features/keizoku/actions/logs";
import { getHabitSummary } from "@/features/keizoku/actions/stats";
import { HabitPage } from "@/features/keizoku/components/HabitPage";
import { addDays } from "@/features/keizoku/lib/streak";
import { getUserToday } from "@/lib/timezone";
import { notFound } from "next/navigation";

export default async function KeizokuHabitPage({
	params,
}: { params: Promise<{ habitId: string }> }) {
	const [{ habitId }, today] = await Promise.all([params, getUserToday()]);
	const habit = await getOwnedHabit(habitId);
	if (!habit) notFound();

	const [summary, days, journal] = await Promise.all([
		getHabitSummary(habit, today),
		// The map's 53 weeks, a week of slack for the Monday it starts on.
		getHabitDays(habitId, addDays(today, -54 * 7), today),
		getHabitJournal(habitId),
	]);

	return <HabitPage habit={habit} summary={summary} days={days} journal={journal} today={today} />;
}
