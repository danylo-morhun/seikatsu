import { auth } from "@/auth";
import { getPendingCaptures } from "@/features/kuroji/actions/capture";
import { getWorkspace } from "@/features/kuroji/actions/workspace";
import { CaptureInbox } from "@/features/kuroji/components/CaptureInbox";
import { KurojiNavTabs } from "@/features/kuroji/components/KurojiNavTabs";
import { KurojiShortcuts } from "@/features/kuroji/components/KurojiShortcuts";

export default async function KurojiLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	const workspace = session?.user?.id ? await getWorkspace(session.user.id) : null;
	const captures = workspace ? await getPendingCaptures(workspace.id) : [];

	return (
		<>
			{workspace && (
				<CaptureInbox
					workspaceId={workspace.id}
					baseCurrency={workspace.baseCurrency}
					captures={captures}
				/>
			)}
			{children}
			<KurojiShortcuts />
			{workspace && (
				<KurojiNavTabs workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
			)}
		</>
	);
}
