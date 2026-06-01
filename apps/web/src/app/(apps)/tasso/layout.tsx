import { auth } from "@/auth";
import { getWorkspace } from "@/features/midas/actions/workspace";
import { getProjects } from "@/features/tasso/actions/projects";
import { TassoLayout } from "@/features/tasso/components/TassoLayout";
import { redirect } from "next/navigation";

export default async function TassoRootLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace = await getWorkspace(session.user.id);
	if (!workspace) redirect("/");

	const projects = await getProjects();

	return (
		<TassoLayout projects={projects} workspaceId={workspace.id}>
			{children}
		</TassoLayout>
	);
}
