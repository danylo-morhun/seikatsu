import { auth } from "@/auth";
import { getWorkspace } from "@/features/midas/actions/workspace";
import { getCards } from "@/features/tasso/actions/cards";
import { getColumns } from "@/features/tasso/actions/columns";
import { getLabels } from "@/features/tasso/actions/labels";
import { getProjects } from "@/features/tasso/actions/projects";
import { KanbanBoard } from "@/features/tasso/components/KanbanBoard";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

export default async function TassoProjectPage({
	params,
}: {
	params: Promise<{ projectId: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace = await getWorkspace(session.user.id);
	if (!workspace) redirect("/");

	const { projectId } = await params;
	const projects = await getProjects(workspace.id);
	const project = projects.find((p) => p.id === projectId);

	if (!project) notFound();

	const [columns, cards, projectLabels] = await Promise.all([
		getColumns(projectId),
		getCards(projectId),
		getLabels(projectId),
	]);

	return (
		<Suspense>
			<KanbanBoard
				projectId={projectId}
				columns={columns}
				cards={cards}
				projectLabels={projectLabels}
			/>
		</Suspense>
	);
}
