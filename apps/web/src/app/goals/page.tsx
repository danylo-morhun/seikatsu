import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { GoalsView } from "@/features/goals/components/GoalsView";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

export default async function GoalsPage() {
	const session = await auth();
	if (!session) redirect("/");
	const [workspace, today] = await Promise.all([getCurrentWorkspace(), getUserToday()]);
	if (!workspace) redirect("/");
	return (
		<AppFrame>
			<GoalsView ws={workspace} today={today} />
		</AppFrame>
	);
}
