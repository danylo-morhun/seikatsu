import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { AppsView } from "@/features/home/components/AppsView";
import { getStarted } from "@/features/home/lib/today";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

export default async function AppsPage() {
	const session = await auth();
	if (!session) redirect("/");
	const [workspace, today] = await Promise.all([getCurrentWorkspace(), getUserToday()]);
	if (!workspace) redirect("/");
	const started = await getStarted(workspace);
	return (
		<AppFrame>
			<AppsView ws={workspace} today={today} started={started} />
		</AppFrame>
	);
}
