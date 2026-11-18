import { GoalCard, type GoalCardData, NewGoal } from "@/features/goals/components/GoalParts";
import type { GoalStepData } from "@/features/goals/components/GoalStep";
import { getGoals, getLinkOptions } from "@/features/goals/lib/data";
import { describeLink, goalAttention, goalProgress, timeLeft } from "@/features/goals/lib/progress";
import { type NextStep, readNextSteps } from "@/features/goals/lib/steps";
import { money } from "@/features/home/lib/format";

const WHEN = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

type Group = "attention" | "track" | "someday";

const GROUPS: { key: Group; title: string; hint: string }[] = [
	{ key: "attention", title: "Needs attention", hint: "behind, close, or nothing to do next" },
	{ key: "track", title: "On track", hint: "" },
	{ key: "someday", title: "Someday", hint: "no date" },
];

const WHY = { soon: "Its day is close", behind: "Behind its pace", over: "Its day has passed" };

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const shortDate = (d: string) => SHORT.format(new Date(`${d}T00:00:00Z`));

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
	const projectIds = list.flatMap((g) =>
		g.links.flatMap((l) => (l.kind === "project" && l.refId ? [l.refId] : [])),
	);
	const steps = await readNextSteps(ws.id, projectIds);
	const cards: (GoalCardData & { group: Group })[] = list.map((g) => {
		const links = g.links.map((l) => ({
			id: l.id,
			kind: l.kind,
			view: describeLink(l.reading, money),
		}));
		const progress = goalProgress(links.map((l) => l.view));
		const attention = goalAttention(
			{
				id: g.id,
				name: g.name,
				targetDate: g.targetDate,
				startedOn: g.createdAt.toISOString().slice(0, 10),
				ratio: progress,
			},
			today,
		);
		// The first linked project with an open card gives the step; else its first one takes one.
		const projects = g.links.flatMap((l) =>
			l.kind === "project" && l.refId && steps.has(l.refId) ? [steps.get(l.refId) as NextStep] : [],
		);
		const withCard = projects.find((p) => p.card);
		const room = projects.find((p) => p.project.firstColumnId);
		const step: GoalStepData | null = withCard?.card
			? {
					kind: "card",
					title: withCard.card.title,
					href: `/seiryu/${withCard.card.projectId}/${withCard.card.id}`,
					note: withCard.card.dueDate
						? `due ${shortDate(withCard.card.dueDate)}`
						: withCard.project.name,
				}
			: room?.project.firstColumnId
				? {
						kind: "add",
						projectId: room.project.id,
						columnId: room.project.firstColumnId,
						projectName: room.project.name,
					}
				: null;
		const why = attention ? WHY[attention] : step?.kind === "add" ? "No next step" : null;
		return {
			group: why ? "attention" : g.targetDate ? "track" : "someday",
			why,
			step,
			id: g.id,
			name: g.name,
			note: g.note,
			targetDate: g.targetDate,
			when: g.targetDate
				? `${WHEN.format(new Date(`${g.targetDate}T00:00:00Z`))} · ${timeLeft(g.targetDate, today)}`
				: null,
			progress,
			links,
		};
	});
	const groups = GROUPS.map((g) => ({
		...g,
		cards: cards.filter((c) => c.group === g.key),
	})).filter((g) => g.cards.length > 0);

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
				<div className="space-y-8">
					{groups.map((group, gi) => (
						<section key={group.key} aria-label={group.title}>
							<h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
								{group.title}
								<span className="ml-2 font-normal">{group.hint}</span>
							</h2>
							<ul aria-label={group.title} className="grid gap-4 lg:grid-cols-2">
								{group.cards.map((card, i) => (
									<GoalCard key={card.id} goal={card} options={options} index={gi * 4 + i + 1} />
								))}
							</ul>
						</section>
					))}
				</div>
			)}
		</div>
	);
}
