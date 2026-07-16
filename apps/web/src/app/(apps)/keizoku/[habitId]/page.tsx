import { auth } from "@/auth";
import { getOwnedHabit } from "@/features/keizoku/actions/guard";
import { getHabitLogs, getHabitPhotos } from "@/features/keizoku/actions/logs";
import { getHabitCompletionRate, getHabitStreaks } from "@/features/keizoku/actions/stats";
import { HabitDetailView } from "@/features/keizoku/components/HabitDetailView";
import { notFound, redirect } from "next/navigation";

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export default async function HabitPage({ params }: { params: Promise<{ habitId: string }> }) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const { habitId } = await params;
	const habit = await getOwnedHabit(habitId);
	if (!habit) notFound();

	const to = today();
	const now = new Date();
	const from30 = new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
	const fromHeatmap = new Date(now.getTime() - (53 * 7 - 1) * 86_400_000)
		.toISOString()
		.slice(0, 10);

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
