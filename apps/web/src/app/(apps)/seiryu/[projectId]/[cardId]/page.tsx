import { getCard } from "@/features/seiryu/actions/cards";
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

	return <CardPage card={card} projectId={projectId} />;
}
