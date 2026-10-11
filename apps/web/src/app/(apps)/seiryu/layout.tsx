import { getOpenCardCounts, getProjects } from "@/features/seiryu/actions/projects";
import { SeiryuLayout } from "@/features/seiryu/components/SeiryuLayout";
import { getCurrentWorkspace } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function SeiryuRootLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");

	const [projects, cardCounts] = await Promise.all([getProjects(), getOpenCardCounts()]);

	return (
		<SeiryuLayout projects={projects} workspaceId={workspace.id} cardCounts={cardCounts}>
			{children}
		</SeiryuLayout>
	);
}
