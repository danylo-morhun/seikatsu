import { auth } from "@/auth";
import { getWorkspace } from "@/features/kuroji/actions/workspace";
import { getCards } from "@/features/seiryu/actions/cards";
import { getColumns } from "@/features/seiryu/actions/columns";
import { getLabels } from "@/features/seiryu/actions/labels";
import { getProjects } from "@/features/seiryu/actions/projects";
import { KanbanBoard } from "@/features/seiryu/components/KanbanBoard";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

export default async function SeiryuProjectPage({
	params,
}: {
	params: Promise<{ projectId: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace = await getWorkspace(session.user.id);
	if (!workspace) redirect("/");

	const { projectId } = await params;
	const projects = await getProjects();
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
