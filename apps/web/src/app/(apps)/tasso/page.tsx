import { auth } from "@/auth";
import { getWorkspace } from "@/features/midas/actions/workspace";
import { getProjects } from "@/features/tasso/actions/projects";
import { redirect } from "next/navigation";

export default async function TassoPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace = await getWorkspace(session.user.id);
	if (!workspace) redirect("/");

	const projects = await getProjects();
	const first = projects[0];

	if (first) redirect(`/tasso/${first.id}`);

	return (
		<div className="flex h-full items-center justify-center">
			<div className="text-center space-y-2">
				<p className="text-lg font-medium">No projects yet</p>
				<p className="text-sm text-muted-foreground">Create your first project in the sidebar.</p>
			</div>
		</div>
	);
}
