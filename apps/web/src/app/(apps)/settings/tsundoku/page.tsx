import { NOTE_LINK, SettingsNote, SettingsPage } from "@/components/SettingsSection";
import { getShelvesWithCounts } from "@/features/tsundoku/actions/shelves";
import { SettingsShelves } from "@/features/tsundoku/components/SettingsShelves";
import { getCurrentWorkspace } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TsundokuSettingsPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const shelves = await getShelvesWithCounts();

	return (
		<SettingsPage title="積 Tsundoku" appNav>
			<SettingsShelves shelves={shelves} />
			<SettingsNote>
				The yearly reading goal is set on the{" "}
				<Link href="/tsundoku/year" prefetch className={NOTE_LINK}>
					Year
				</Link>{" "}
				page.
			</SettingsNote>
		</SettingsPage>
	);
}
