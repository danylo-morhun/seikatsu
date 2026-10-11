import { getCard } from "@/features/seiryu/actions/cards";
import { getColumns } from "@/features/seiryu/actions/columns";
import { getLabels } from "@/features/seiryu/actions/labels";
import { getProjects } from "@/features/seiryu/actions/projects";
import { CardPage } from "@/features/seiryu/components/CardPage";
import { notFound } from "next/navigation";

export default async function CardDetailPage({
	params,
}: {
	params: Promise<{ projectId: string; cardId: string }>;
}) {
	const { projectId, cardId } = await params;
	const card = await getCard(cardId);
	if (!card || card.projectId !== projectId) notFound();

	const [projects, columns, labels] = await Promise.all([
		getProjects(),
		getColumns(projectId),
		getLabels(projectId),
	]);
	const project = projects.find((p) => p.id === projectId);
	if (!project) notFound();

	return (
		<CardPage
			card={card}
			projectName={project.name}
			columns={columns.map(({ id, name }) => ({ id, name }))}
			projectLabels={labels}
		/>
	);
}
