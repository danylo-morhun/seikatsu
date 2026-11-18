import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { MorningFlow } from "@/features/day/components/MorningFlow";
import { loadDay } from "@/features/day/lib/data";
import type { FocusPick } from "@/features/day/lib/day";
import { formatMoney } from "@/features/hoshii/lib/format";
import { getFocus } from "@/features/seiryu/lib/focus-data";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

const asMoney = (amount: number, currency: string) => formatMoney(amount, currency, true);

export default async function MorningPage({
	searchParams,
}: {
	searchParams: Promise<{ step?: string }>;
}) {
	const session = await auth();
	if (!session) redirect("/");
	const [workspace, today, { step }] = await Promise.all([
		getCurrentWorkspace(),
		getUserToday(),
		searchParams,
	]);
	if (!workspace) redirect("/");
	const [day, focus] = await Promise.all([
		loadDay(workspace, today, asMoney),
		getFocus().catch(() => null),
	]);
	// Cards already under way, for the pick: Focus's "In progress".
	const doing: FocusPick[] =
		focus?.sections
			.find((s) => s.key === "doing")
			?.cards.map(({ id, title, projectId, projectName }) => ({
				id,
				title,
				projectId,
				projectName,
			})) ?? [];
	return (
		<AppFrame>
			<MorningFlow
				today={today}
				items={day.queue}
				focus={doing}
				carried={day.carried}
				picked={day.plan?.plannedAt ? day.plan.picks.map((p) => p.key) : null}
				startOnPick={step === "pick"}
			/>
		</AppFrame>
	);
}
