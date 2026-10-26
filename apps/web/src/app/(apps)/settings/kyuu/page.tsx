import { NOTE_LINK, SettingsNote, SettingsPage } from "@/components/SettingsSection";
import { getSources } from "@/features/kyuu/actions/applications";
import { countMissingCountries } from "@/features/kyuu/actions/countries";
import { getMailKeyStatus } from "@/features/kyuu/actions/mail";
import { SettingsCountries } from "@/features/kyuu/components/SettingsCountries";
import { SettingsMail } from "@/features/kyuu/components/SettingsMail";
import { SettingsSources } from "@/features/kyuu/components/SettingsSources";
import { getCurrentWorkspace } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function KyuuSettingsPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const [sources, missingCountries, mailKey] = await Promise.all([
		getSources(),
		countMissingCountries(),
		getMailKeyStatus(),
	]);

	return (
		<SettingsPage title="求 Kyuu" appNav>
			<SettingsSources sources={sources} />
			<SettingsMail status={mailKey} />
			<SettingsCountries missing={missingCountries} />
			<SettingsNote>
				Archived applications live under{" "}
				<Link href="/kyuu/all?view=archived" prefetch className={NOTE_LINK}>
					All · Archived
				</Link>
				, where they can be restored or deleted.
			</SettingsNote>
		</SettingsPage>
	);
}
