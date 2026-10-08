import { auth } from "@/auth";
import { getOwnedHabit } from "@/features/keizoku/actions/guard";
import { getHabitLogs, getHabitPhotos } from "@/features/keizoku/actions/logs";
import { getHabitCompletionRate, getHabitStreaks } from "@/features/keizoku/actions/stats";
import { HabitDetailView } from "@/features/keizoku/components/HabitDetailView";
import { getUserToday } from "@/lib/timezone";
import { notFound, redirect } from "next/navigation";

/** `date` (YYYY-MM-DD) minus `days`, as YYYY-MM-DD. Pure calendar math in UTC. */
function daysBefore(date: string, days: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

export default async function HabitPage({ params }: { params: Promise<{ habitId: string }> }) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const { habitId } = await params;
	const habit = await getOwnedHabit(habitId);
	if (!habit) notFound();

	// The user's day, not the server's UTC one: right after local midnight that differs.
	const to = await getUserToday();
	const from30 = daysBefore(to, 29);
	const fromHeatmap = daysBefore(to, 53 * 7 - 1);

	const [logs, photos, streak, completionRate] = await Promise.all([
		getHabitLogs(habitId, fromHeatmap, to),
		getHabitPhotos(habitId),
		getHabitStreaks(habitId, to),
		getHabitCompletionRate(habitId, from30, to),
	]);

	return (
		<HabitDetailView
			habit={habit}
			logs={logs}
			photos={photos}
			streak={streak ?? { current: 0, best: 0 }}
			completionRate={completionRate ?? 0}
		/>
	);
}
