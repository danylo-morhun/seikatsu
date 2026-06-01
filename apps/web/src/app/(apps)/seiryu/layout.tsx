import { auth } from "@/auth";
import { getWorkspace } from "@/features/kuroji/actions/workspace";
import { getNotDoneCardCounts, getProjects } from "@/features/seiryu/actions/projects";
import { SeiryuLayout } from "@/features/seiryu/components/SeiryuLayout";
import { redirect } from "next/navigation";

export default async function SeiryuRootLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace = await getWorkspace(session.user.id);
	if (!workspace) redirect("/");

	const [projects, cardCounts] = await Promise.all([getProjects(), getNotDoneCardCounts()]);

	return (
		<SeiryuLayout projects={projects} workspaceId={workspace.id} cardCounts={cardCounts}>
			{children}
		</SeiryuLayout>
	);
}
