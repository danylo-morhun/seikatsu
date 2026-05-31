import { auth } from "@/auth";
import { getCard } from "@/features/tasso/actions/cards";
import { CardPage } from "@/features/tasso/components/CardPage";
import { notFound, redirect } from "next/navigation";

export default async function CardDetailPage({
	params,
}: {
	params: Promise<{ projectId: string; cardId: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const { projectId, cardId } = await params;
	const card = await getCard(cardId);

	if (!card || card.projectId !== projectId) notFound();

	return <CardPage card={card} projectId={projectId} />;
}
