import { getArchivedHabits } from "@/features/keizoku/actions/habits";
import { ArchivedHabits } from "@/features/keizoku/components/HabitLists";

export default async function KeizokuArchivePage() {
	const habits = await getArchivedHabits();

	return (
		<div className="max-w-3xl px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<h1 className="mb-1 text-xl font-semibold">Archive</h1>
			<p className="mb-6 text-sm text-muted-foreground">
				Off Today, history kept. Their days still count in the Year.
			</p>
			<ArchivedHabits habits={habits} />
		</div>
	);
}
