"use client";

import { requestNewBook } from "@/features/tsundoku/lib/events";
import { Button } from "@seikatsu/ui";

const STEPS = [
	{
		title: "Pile up what you want to read",
		body: "Search Open Library and Google Books, or add a book by hand. Press N anywhere.",
	},
	{
		title: "Say where you are",
		body: "“I'm on page 140” or “45%” — each update counts as a reading day for your streak.",
	},
	{
		title: "Keep what stayed with you",
		body: "A rating, a few lines of notes and the quotes worth keeping; the year adds itself up.",
	},
];

/** First run: no books yet. Lead with adding one, and say how the pile works. */
export function TsundokuWelcome() {
	return (
		<section aria-labelledby="tsundoku-welcome" className="max-w-2xl py-4 md:py-6">
			<h1 id="tsundoku-welcome" className="animate-rise text-2xl font-semibold md:text-3xl">
				Your pile starts here.
			</h1>
			<p
				className="animate-rise mt-3 max-w-prose text-muted-foreground"
				style={{ "--i": 1 } as React.CSSProperties}
			>
				積ん読 — books bought and left to pile up. Tsundoku keeps the pile, the book you're in, and
				what you thought of each one.
			</p>
			<div className="animate-rise mt-6" style={{ "--i": 2 } as React.CSSProperties}>
				<Button onClick={requestNewBook} aria-keyshortcuts="N">
					Add your first book
				</Button>
			</div>

			<ol
				className="animate-rise mt-12 divide-y divide-rule border-y border-rule"
				style={{ "--i": 3 } as React.CSSProperties}
			>
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
