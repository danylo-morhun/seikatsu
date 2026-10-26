import { NOTE_LINK, SettingsNote, SettingsPage } from "@/components/SettingsSection";
import { getHabits } from "@/features/keizoku/actions/habits";
import { SettingsHabits } from "@/features/keizoku/components/HabitLists";
import { getCurrentWorkspace } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function KeizokuSettingsPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const habits = await getHabits();

	return (
		<SettingsPage title="継 Keizoku" appNav>
			<SettingsHabits habits={habits} />
			<SettingsNote>
				Archived habits live in the{" "}
				<Link href="/keizoku/archive" prefetch className={NOTE_LINK}>
					Archive
				</Link>
				, where they can be restored or deleted.
			</SettingsNote>
		</SettingsPage>
	);
}
