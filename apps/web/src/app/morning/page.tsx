import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { MorningFlow } from "@/features/day/components/MorningFlow";
import { loadDay } from "@/features/day/lib/data";
import type { FocusPick } from "@/features/day/lib/day";
import { readGoalProjects } from "@/features/goals/lib/steps";
import { formatMoney } from "@/features/hoshii/lib/format";
import { getFocus } from "@/features/seiryu/lib/focus-data";
import { loadWeekRhythm } from "@/features/week/lib/plan-data";
import { modulesOn } from "@/lib/modules";
import { getCurrentWorkspace, requireModule } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

const asMoney = (amount: number, currency: string) => formatMoney(amount, currency, true);

export default async function MorningPage({
	searchParams,
}: {
	searchParams: Promise<{ step?: string }>;
}) {
	await requireModule("/day");
	const session = await auth();
	if (!session) redirect("/");
	const [workspace, today, { step }] = await Promise.all([
		getCurrentWorkspace(),
		getUserToday(),
		searchParams,
	]);
	if (!workspace) redirect("/");
	const on = modulesOn(workspace.modulesOff);
	const [day, focus, rhythm, goalProjects] = await Promise.all([
		loadDay(workspace, today, asMoney),
		on.includes("/seiryu") ? getFocus().catch(() => null) : null,
		on.includes("/week/plan") ? loadWeekRhythm(workspace, today, asMoney).catch(() => null) : null,
		on.includes("/goals")
			? readGoalProjects(workspace.id).catch(() => new Map<string, string>())
			: new Map<string, string>(),
	]);
	const weekFocus = (rhythm?.focus ?? [])
		.filter((f) => !f.done)
		.map(({ key, title, href, app }) => ({ key, title, href, app }));
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
				weekFocus={weekFocus}
				goals={Object.fromEntries(goalProjects)}
				picked={day.plan?.plannedAt ? day.plan.picks.map((p) => p.key) : null}
				startOnPick={step === "pick"}
			/>
		</AppFrame>
	);
}
