import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The week is the home calendar's week view now; old links (pushes, bookmarks) land there. */
export default async function WeekPage({
	searchParams,
}: {
	searchParams: Promise<{ w?: string }>;
}) {
	await requireModule("/week");
	const { w } = await searchParams;
	redirect(w && DAY.test(w) ? `/?v=week&d=${w}` : "/?v=week");
}
