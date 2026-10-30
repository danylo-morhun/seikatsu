import { PageTitle } from "@/components/PageTitle";
import { getArchivedHabits } from "@/features/keizoku/actions/habits";
import { ArchivedHabits } from "@/features/keizoku/components/HabitLists";

export default async function KeizokuArchivePage() {
	const habits = await getArchivedHabits();

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<PageTitle
				title="Archive"
				subtitle="Off Today, history kept. Their days still count in the Year."
			/>
			<ArchivedHabits habits={habits} />
		</div>
	);
}
