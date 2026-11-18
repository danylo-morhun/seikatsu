import { z } from "zod";
import { closeDay, savePlan, snoozeRow } from "@/features/day/actions/day";
import { loadDay, readEvening, readOpenCards } from "@/features/day/lib/data";
import { cardIdOf, dayPhase, MAX_PICKS, pickOf } from "@/features/day/lib/day";
import { money } from "@/features/home/lib/format";
import { localClock, safeTimeZone } from "@/features/pwa/lib/schedule";
import { updateCard } from "@/features/seiryu/actions/cards";
import { saveWeek } from "@/features/week/actions/plan";
import { loadWeekRhythm, readFocusOptions } from "@/features/week/lib/plan-data";
import { MAX_FOCUS } from "@/features/week/lib/rhythm";
import { getUserTimeZone } from "@/lib/timezone";
import { tool } from "./types";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const key = z.string().min(3).max(200).describe("A row's key, as `today` or `day` lists it");

export const dayTools = [
	tool({
		name: "day",
		title: "My day",
		description:
			"Where today stands: its phase (plan = not planned yet, day = planned, close = evening, closed), the up-to-three picks with whether each is done, yesterday's unfinished picks (carried), and the list the morning sorts. Use before day_plan or day_later.",
		input: {},
		run: async (_args, { ws, today }) => {
			const fmt = (n: number, c = ws.baseCurrency) => money(n, c);
			const [d, evening, zone] = await Promise.all([
				loadDay(ws, today, fmt),
				readEvening(ws.id),
				getUserTimeZone(),
			]);
			const minutes = localClock(safeTimeZone(zone)).minutes;
			return {
				today,
				phase: dayPhase(d.plan, minutes, evening.time),
				eveningTime: evening.time,
				picks: d.picks.map(({ key, title, app, done }) => ({
					key,
					title,
					app: app.slice(1),
					done,
				})),
				carried: d.carried.map(({ key, title }) => ({ key, title })),
				waiting: d.queue.map(({ key, title, note, tone }) => ({ key, title, note, tone })),
			};
		},
	}),
	tool({
		name: "day_plan",
		title: "Pick today's three",
		description: `Plans today with up to ${MAX_PICKS} things, by key: rows from \`day\`/\`today\`, or any open Seiryu card as \`seiryu:<card id>\`. Replaces today's picks. Ask the user which ones; don't choose for them.`,
		input: { keys: z.array(key).max(MAX_PICKS) },
		write: true,
		idempotent: true,
		run: async ({ keys }, { ws, today }) => {
			const fmt = (n: number, c = ws.baseCurrency) => money(n, c);
			const d = await loadDay(ws, today, fmt);
			const listed = new Map(
				[...d.queue.map(pickOf), ...d.carried].map((p) => [p.key, p] as const),
			);
			const cards = await readOpenCards(
				ws.id,
				keys.flatMap((k) => (listed.has(k) ? [] : (cardIdOf(k) ?? []))),
			);
			const byCard = new Map(cards.map((c) => [c.id, c]));
			const picks = [];
			for (const k of keys) {
				const hit = listed.get(k);
				const card = byCard.get(cardIdOf(k) ?? "");
				if (hit) picks.push(hit);
				else if (card)
					picks.push({
						key: k,
						title: card.title,
						href: `/seiryu/${card.projectId}/${card.id}`,
						app: "/seiryu",
					});
				else return { error: `Nothing waits under ${k}` };
			}
			return savePlan({ day: today, picks });
		},
	}),
	tool({
		name: "day_later",
		title: "Put a row off",
		description:
			"Puts one row of today's list off until a day: a Seiryu card (`seiryu:<id>`) moves its due date; anything else (payments to add, quiet applications, a fund's instalment…) stays off the list until then.",
		input: { key, until: day.describe("The first day it shows again (after today)") },
		write: true,
		idempotent: true,
		run: async ({ key: k, until }, { today }) => {
			if (until <= today) return { error: "Pick a day after today" };
			const cardId = cardIdOf(k);
			return cardId ? updateCard({ cardId, dueDate: until }) : snoozeRow({ key: k, until });
		},
	}),
	tool({
		name: "day_close",
		title: "Close the day",
		description:
			"Marks today closed, as the evening's last step does: Today goes quiet until the morning.",
		input: {},
		write: true,
		idempotent: true,
		run: (_args, { today }) => closeDay({ day: today }),
	}),
];

export const weekTools = [
	tool({
		name: "week_focus",
		title: "The week's focus",
		description:
			"The week's plan: which week is due for planning (next week from Sunday evening on), whether it's planned, this week's focus (up to three, each with done), and what the focus could be: last week's leftovers, goals' next steps, cards in progress or due soon. Use before week_set_focus.",
		input: {},
		run: async (_args, { ws, today }) => {
			const fmt = (n: number, c = ws.baseCurrency) => money(n, c);
			const rhythm = await loadWeekRhythm(ws, today, fmt);
			const options = await readFocusOptions(ws, today, fmt, rhythm.target);
			return {
				target: rhythm.target,
				phase: rhythm.phase,
				focus: rhythm.focus.map(({ key, title, done }) => ({ key, title, done })),
				goalsNeedingAHand: options.needs,
				candidates: options.candidates.map(({ key, title, from, goal }) => ({
					key,
					title,
					from,
					goal,
				})),
			};
		},
	}),
	tool({
		name: "week_set_focus",
		title: "Set the week's focus",
		description: `Plans the week due for planning with up to ${MAX_FOCUS} things: candidate keys from week_focus, any open Seiryu card as \`seiryu:<card id>\`, or the user's own words as { title }. Replaces that week's focus and marks the week before looked back on. Ask the user which ones.`,
		input: {
			items: z
				.array(z.union([z.object({ key }), z.object({ title: z.string().trim().min(1).max(200) })]))
				.max(MAX_FOCUS),
		},
		write: true,
		run: async ({ items }, { ws, today }) => {
			const fmt = (n: number, c = ws.baseCurrency) => money(n, c);
			const rhythm = await loadWeekRhythm(ws, today, fmt);
			const options = await readFocusOptions(ws, today, fmt, rhythm.target);
			const known = new Map(options.candidates.map((c) => [c.key, c]));
			const cardKeys = items.flatMap((i) =>
				"key" in i && !known.has(i.key) ? (cardIdOf(i.key) ?? []) : [],
			);
			const cards = new Map((await readOpenCards(ws.id, cardKeys)).map((c) => [c.id, c]));
			const focus = [];
			for (const i of items) {
				if ("title" in i) {
					focus.push({
						key: `own:${crypto.randomUUID()}`,
						title: i.title,
						href: "/week",
						app: "/week",
					});
					continue;
				}
				const hit = known.get(i.key);
				const card = cards.get(cardIdOf(i.key) ?? "");
				if (hit) focus.push({ key: hit.key, title: hit.title, href: hit.href, app: hit.app });
				else if (card)
					focus.push({
						key: i.key,
						title: card.title,
						href: `/seiryu/${card.projectId}/${card.id}`,
						app: "/seiryu",
					});
				else return { error: `Nothing to focus on under ${i.key}` };
			}
			return saveWeek({ weekStart: rhythm.target, focus });
		},
	}),
];
