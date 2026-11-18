import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { money } from "@/features/home/lib/format";
import { addDays } from "@/features/seiryu/lib/filters";
import { WeekPlanFlow } from "@/features/week/components/WeekPlanFlow";
import { getWeekData } from "@/features/week/lib/data";
import {
	loadWeekRhythm,
	readDayPlans,
	readFocusOptions,
	readWeekPlan,
} from "@/features/week/lib/plan-data";
import { lookBack } from "@/features/week/lib/rhythm";
import { buildWeek, weekLine, weekOf } from "@/features/week/lib/week";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

export default async function WeekPlanPage() {
	const session = await auth();
	if (!session) redirect("/");
	const [workspace, today] = await Promise.all([getCurrentWorkspace(), getUserToday()]);
	if (!workspace) redirect("/");
	const fmt = (n: number, c = workspace.baseCurrency) => money(n, c);
	const { target } = await loadWeekRhythm(workspace, today, fmt);
	// The week looked back on: the one before the week being planned, up to today.
	const looked = weekOf(addDays(target, -7));
	const [data, days, options, plan] = await Promise.all([
		getWeekData(workspace, today, looked),
		readDayPlans(workspace.id, looked[0] ?? target, looked[6] ?? target),
		readFocusOptions(workspace, today, fmt, target),
		readWeekPlan(workspace.id, target),
	]);
	const { totals } = buildWeek(data, today, looked, fmt);
	const look = lookBack(days);
	const thisMonday = weekOf(today)[0];
	return (
		<AppFrame>
			<WeekPlanFlow
				target={target}
				next={target !== thisMonday}
				look={{
					title: target !== thisMonday ? "This week" : "Last week",
					line: weekLine(totals, fmt),
					planned: look.planned,
					closed: look.closed,
					done: look.done,
					of: look.of,
					habits: totals.expected > 0 ? Math.round((totals.ticks / totals.expected) * 100) : null,
					cardsDone: totals.cardsDone,
				}}
				needs={options.needs}
				candidates={options.candidates}
				picked={plan?.plannedAt ? plan.focus : null}
			/>
		</AppFrame>
	);
}
