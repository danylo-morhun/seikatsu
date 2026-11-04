import { GoalCard, type GoalCardData, NewGoal } from "@/features/goals/components/GoalParts";
import { getGoals, getLinkOptions } from "@/features/goals/lib/data";
import { describeLink, goalProgress, timeLeft } from "@/features/goals/lib/progress";
import { money } from "@/features/home/lib/format";

const WHEN = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

/**
 * 志 Goals: what the apps are for. Each goal gathers whole containers (a fund, a project, a
 * habit, a list, a shelf, the job search) and shows how far they've come together.
 */
export async function GoalsView({
	ws,
	today,
}: {
	ws: { id: string; baseCurrency: string };
	today: string;
}) {
	const [list, options] = await Promise.all([getGoals(ws, today), getLinkOptions(ws.id)]);
	const cards: GoalCardData[] = list.map((g) => {
		const links = g.links.map((l) => ({
			id: l.id,
			kind: l.kind,
			view: describeLink(l.reading, money),
		}));
		return {
			id: g.id,
			name: g.name,
			note: g.note,
			targetDate: g.targetDate,
			when: g.targetDate
				? `${WHEN.format(new Date(`${g.targetDate}T00:00:00Z`))} · ${timeLeft(g.targetDate, today)}`
				: null,
			progress: goalProgress(links.map((l) => l.view)),
			links,
		};
	});

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-5 pb-28 sm:px-8 md:space-y-8 md:py-8">
			<header className="flex animate-rise flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold tracking-tight md:text-3xl">Goals</h1>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						What the apps are for. A goal gathers a fund, a project, habits, a wish list, a shelf or
						the job search, and shows how far they've come together.
					</p>
				</div>
				{cards.length > 0 && <NewGoal />}
			</header>

			{cards.length === 0 ? (
				<div className="animate-rise space-y-3 rounded-group bg-[var(--group-bg)] p-[var(--group-px)] [--i:1]">
					<p className="text-sm text-muted-foreground">
						No goals yet. Try "Tatry in February": link the Tatry fund in Kuroji, the trip project
						in Seiryu and the Gym habit.
					</p>
					<NewGoal />
				</div>
			) : (
				<ul aria-label="Goals" className="grid gap-4 lg:grid-cols-2">
					{cards.map((card, i) => (
						<GoalCard key={card.id} goal={card} options={options} index={i + 1} />
					))}
				</ul>
			)}
		</div>
	);
}
