import { getTodayHabits } from "@/features/keizoku/actions/logs";
import { KeizokuWelcome } from "@/features/keizoku/components/KeizokuWelcome";
import { TodayView } from "@/features/keizoku/components/TodayView";
import { getUserToday } from "@/lib/timezone";

export default async function KeizokuPage() {
	const today = await getUserToday();
	const habits = await getTodayHabits(today);

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			{habits.length === 0 ? <KeizokuWelcome /> : <TodayView habits={habits} today={today} />}
		</div>
	);
}
