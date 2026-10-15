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
		<div className="max-w-3xl px-4 pt-6 pb-28 sm:px-8 md:pt-8 md:pb-8">
			<h1 className="mb-8 text-xl font-semibold">継 Keizoku</h1>
			<SettingsHabits habits={habits} />
			<p className="mt-10 text-sm text-muted-foreground">
				Archived habits live in the{" "}
				<Link
					href="/keizoku/archive"
					prefetch
					className="text-foreground underline-offset-2 hover:underline"
				>
					Archive
				</Link>
				, where they can be restored or deleted.
			</p>
		</div>
	);
}
