"use client";

import { AppWelcome } from "@/components/AppWelcome";
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
		<AppWelcome
			app="/tsundoku"
			title="Your pile starts here."
			lead="積ん読 — books bought and left to pile up. Tsundoku keeps the pile, the book you're in, and what you thought of each one."
			steps={STEPS}
		>
			<Button onClick={requestNewBook} aria-keyshortcuts="N">
				Add your first book
			</Button>
		</AppWelcome>
	);
}
