"use client";

import { AppWelcome } from "@/components/AppWelcome";
import { requestNewApplication } from "@/features/kyuu/lib/events";
import { Button } from "@seikatsu/ui";

const STEPS = [
	{
		title: "Write down each job you're after",
		body: "The company, the role and the link — before you send anything. Press N anywhere.",
	},
	{
		title: "Move it along",
		body: "Applied, interview, offer or no: each step lands on the application's timeline.",
	},
	{
		title: "Let the inbox fill it in",
		body: "Forward replies from Gmail with a small script; Kyuu reads them and updates the rows.",
		href: "/settings/kyuu",
		cta: "Set up mail",
	},
];

/** First run: no applications yet. Lead with adding one, and say how the queue works. */
export function KyuuWelcome() {
	return (
		<AppWelcome
			app="/kyuu"
			title="Keep the search in one place."
			lead="求 — to seek. Kyuu tracks every application from the first look to the answer: what's still to send, who you're waiting on, and who has gone quiet long enough to let go."
			steps={STEPS}
		>
			<Button onClick={requestNewApplication} aria-keyshortcuts="N">
				Add your first application
			</Button>
		</AppWelcome>
	);
}
