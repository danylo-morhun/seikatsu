import { auth } from "@/auth";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { TsundokuNavTabs } from "@/features/tsundoku/components/TsundokuNavTabs";
import { redirect } from "next/navigation";

export default async function TsundokuLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	return (
		<div className="flex flex-col">
			<TsundokuNavTabs workspaceId={workspace.id} />
			{children}
		</div>
	);
}
