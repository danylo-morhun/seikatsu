import { auth } from "@/auth";
import { TodayList } from "@/features/keizoku/components/TodayList";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { redirect } from "next/navigation";

export default async function KeizokuPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	return <TodayList workspaceId={workspace.id} />;
}
