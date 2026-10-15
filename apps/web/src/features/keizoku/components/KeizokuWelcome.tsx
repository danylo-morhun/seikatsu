"use client";

import { requestNewHabit } from "@/features/keizoku/lib/events";
import { Button } from "@seikatsu/ui";
import type { CSSProperties } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

const STEPS = [
	{
		title: "Name a few habits",
		body: "Every day, on some days, or a number of times a week. Press N anywhere.",
	},
	{
		title: "Tick them off",
		body: "One tap a day. Forgot yesterday? Tap that day in the week beside it.",
	},
	{
		title: "Watch the thread",
		body: "Runs, the week and the year add themselves up. A missed day doesn't end the year.",
	},
];

/** First run: no habits yet. Lead with adding one, and say how the week works. */
export function KeizokuWelcome() {
	return (
		<section aria-labelledby="keizoku-welcome" className="max-w-2xl py-4 md:py-6">
			<h1 id="keizoku-welcome" className="animate-rise text-2xl font-semibold md:text-3xl">
				Small things, carried on.
			</h1>
			<p className="animate-rise mt-3 max-w-prose text-muted-foreground" style={rise(1)}>
				継続 — continuing. Keizoku keeps the habits you want to keep, a day at a time, and lets you
				fill in the days you forgot.
			</p>
			<div className="animate-rise mt-6" style={rise(2)}>
				<Button onClick={requestNewHabit} aria-keyshortcuts="N">
					Add your first habit
				</Button>
			</div>

			<ol className="animate-rise mt-12 divide-y divide-rule border-y border-rule" style={rise(3)}>
				{STEPS.map((step, i) => (
					<li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-4">
						<span className="font-figures text-sm text-muted-foreground">{i + 1}</span>
						<span>
							<span className="block text-sm font-medium">{step.title}</span>
							<span className="mt-0.5 block text-sm text-muted-foreground">{step.body}</span>
						</span>
					</li>
				))}
			</ol>
		</section>
	);
}
