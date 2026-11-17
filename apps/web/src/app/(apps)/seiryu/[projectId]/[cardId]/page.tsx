import { notFound } from "next/navigation";
import { getBoard, getCard } from "@/features/seiryu/actions/cards";
import { getProjects } from "@/features/seiryu/actions/projects";
import { CardPage } from "@/features/seiryu/components/CardPage";
import { getUserToday } from "@/lib/timezone";

export default async function CardDetailPage({
	params,
}: {
	params: Promise<{ projectId: string; cardId: string }>;
}) {
	const { projectId, cardId } = await params;
	const card = await getCard(cardId);
	if (!card || card.projectId !== projectId) notFound();

	const [projects, board, today] = await Promise.all([
		getProjects(),
		getBoard(projectId),
		getUserToday(),
	]);
	const project = projects.find((p) => p.id === projectId);
	if (!project || !board) notFound();
	const done = new Set(board.columns.filter((c) => c.isDone).map((c) => c.id));

	return (
		<CardPage
			card={card}
			projectName={project.name}
			columns={board.columns.map(({ id, name }) => ({ id, name }))}
			projectLabels={board.labels}
			groups={board.groups}
			candidates={board.cards
				.filter((c) => !done.has(c.columnId))
				.map(({ id, title }) => ({ id, title }))}
			today={today}
		/>
	);
}
