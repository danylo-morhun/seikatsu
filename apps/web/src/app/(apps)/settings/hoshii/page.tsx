import { SettingsPage } from "@/components/SettingsSection";
import { getHoshii } from "@/features/hoshii/actions/data";
import { SettingsHoshii } from "@/features/hoshii/components/SettingsHoshii";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";

export default async function HoshiiSettingsPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const [data, accounts] = await Promise.all([
		getHoshii(workspace, await getUserToday()),
		getAccounts(workspace.id),
	]);
	const { workspaceId: _, ...settings } = data.settings;

	return (
		<SettingsPage title="欲 Hoshii" appNav>
			<SettingsHoshii
				settings={settings}
				lists={data.lists}
				accounts={accounts}
				currency={data.currency}
			/>
		</SettingsPage>
	);
}
