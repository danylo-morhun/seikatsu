import { auth } from "@/auth";
import { getWorkspace } from "@/features/kuroji/actions/workspace";
import { KurojiNavTabs } from "@/features/kuroji/components/KurojiNavTabs";

// Kuroji's settings are a Kuroji tab on phones: keep its bottom navigation here too.
export default async function KurojiSettingsLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	const workspace = session?.user?.id ? await getWorkspace(session.user.id) : null;

	return (
		<>
			{children}
			{workspace && (
				<KurojiNavTabs workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
			)}
		</>
	);
}
