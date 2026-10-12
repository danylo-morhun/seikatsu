import { auth } from "@/auth";
import { getWorkspace } from "@/features/kuroji/actions/workspace";
import { KurojiNavTabs } from "@/features/kuroji/components/KurojiNavTabs";
import { KurojiShortcuts } from "@/features/kuroji/components/KurojiShortcuts";

export default async function KurojiLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	const workspace = session?.user?.id ? await getWorkspace(session.user.id) : null;

	return (
		<>
			{children}
			<KurojiShortcuts />
			{workspace && (
				<KurojiNavTabs workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
			)}
		</>
	);
}
