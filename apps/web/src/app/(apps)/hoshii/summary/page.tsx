import { redirect } from "next/navigation";

/** The year's page was called Summary; old links land on Year. */
export default async function HoshiiSummaryRedirect({
	searchParams,
}: {
	searchParams: Promise<{ year?: string }>;
}) {
	const { year } = await searchParams;
	redirect(year ? `/hoshii/year?year=${encodeURIComponent(year)}` : "/hoshii/year");
}
