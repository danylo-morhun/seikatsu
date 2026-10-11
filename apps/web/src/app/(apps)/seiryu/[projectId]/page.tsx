import { getCards } from "@/features/seiryu/actions/cards";
import { getColumns } from "@/features/seiryu/actions/columns";
import { getLabels } from "@/features/seiryu/actions/labels";
import { getProjects } from "@/features/seiryu/actions/projects";
import { KanbanBoard } from "@/features/seiryu/components/KanbanBoard";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function SeiryuProjectPage({
	params,
}: {
	params: Promise<{ projectId: string }>;
}) {
	const { projectId } = await params;
	const projects = await getProjects();
	const project = projects.find((p) => p.id === projectId);

	// Stale links (a deleted project) land on the Seiryu index instead of a 404.
	if (!project) redirect("/seiryu");

	const [columns, cards, projectLabels, today] = await Promise.all([
		getColumns(projectId),
		getCards(projectId),
		getLabels(projectId),
		getUserToday(),
	]);

	return (
		<Suspense>
			<KanbanBoard
				project={{ id: project.id, name: project.name }}
				today={today}
				columns={columns}
				cards={cards}
				projectLabels={projectLabels}
			/>
		</Suspense>
	);
}
