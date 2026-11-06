import { z } from "zod";
import { getGoals } from "@/features/goals/lib/data";
import { describeLink, goalProgress, timeLeft } from "@/features/goals/lib/progress";
import { readAgenda } from "@/features/home/lib/agenda";
import { money } from "@/features/home/lib/format";
import { buildQueue } from "@/features/home/lib/queue";
import { getTodayHabits } from "@/features/keizoku/actions/logs";
import { addDays } from "@/features/keizoku/lib/streak";
import { getWeekData } from "@/features/week/lib/data";
import { buildWeek, weekLine, weekOf } from "@/features/week/lib/week";
import { tool } from "./types";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const shellTools = [
	tool({
		name: "today",
		title: "Today",
		description:
			"What waits on the user today across every app, as the Today page lists it: overdue first, then due, then info (cards, car, money, wants to decide, job follow-ups, goals). Also today's habits and whether each is ticked. Start here for 'what do I have to do'.",
		input: {},
		run: async (_args, { ws, today }) => {
			const fmt = (n: number, c = ws.baseCurrency) => money(n, c);
			const [agenda, habits] = await Promise.all([readAgenda(ws, today), getTodayHabits(today)]);
			return {
				today,
				baseCurrency: ws.baseCurrency,
				todo: buildQueue(agenda, today, fmt).map(({ app, title, note, tone, key }) => ({
					app: app.slice(1),
					tone,
					title,
					note,
					key,
				})),
				habits: habits.map((h) => {
					const now = h.days.at(-1);
					return {
						id: h.habit.id,
						name: h.habit.name,
						due: h.due,
						done: now?.done ?? false,
						note: now?.note,
						streak: h.streak,
					};
				}),
			};
		},
	}),
	tool({
		name: "week",
		title: "Week",
		description:
			"One week Monday–Sunday: for days behind, what got done (spent, habits, pages read, km, cards done, job events, wants moved); for days ahead, what's planned (cards due, car due, recurring payments, wants done cooling, calls). `offset` 0 = this week, -1 = last week, 1 = next.",
		input: { offset: z.number().int().min(-52).max(52).default(0) },
		run: async ({ offset }, { ws, today }) => {
			const week = weekOf(addDays(today, offset * 7));
			const fmt = (n: number, c = ws.baseCurrency) => money(n, c);
			const data = await getWeekData(ws, today, week);
			const { days, totals } = buildWeek(data, today, week, fmt);
			return {
				from: week[0],
				to: week[6],
				summary: weekLine(totals, fmt),
				totals,
				days: days.map((d) => ({
					date: d.date,
					today: d.isToday || undefined,
					done: d.done.map(({ app, title, note }) => ({ app: app.slice(1), title, note })),
					plan: d.plan.map(({ app, title, note, card }) => ({
						app: app.slice(1),
						title,
						note,
						cardId: card?.id,
					})),
				})),
			};
		},
	}),
	tool({
		name: "goals",
		title: "Goals",
		description:
			"Open goals with their date, time left, overall progress (0–1) and each linked container's reading (Kuroji fund, Seiryu project, Keizoku habit, Hoshii list, Tsundoku shelf, Kyuu search).",
		input: {},
		run: async (_args, { ws, today }) => {
			const fmt = (n: number, c: string) => money(n, c);
			const goals = await getGoals(ws, today);
			return goals.map((g) => {
				const views = g.links.map((l) => describeLink(l.reading, fmt));
				return {
					id: g.id,
					name: g.name,
					note: g.note,
					targetDate: g.targetDate,
					timeLeft: g.targetDate ? timeLeft(g.targetDate, today) : null,
					progress: goalProgress(views),
					links: views.map(({ app, title, detail, ratio }) => ({
						app: app.slice(1),
						title,
						detail,
						ratio,
					})),
				};
			});
		},
	}),
];

export { day };
