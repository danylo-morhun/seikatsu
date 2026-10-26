"use client";

import { AppWelcome } from "@/components/AppWelcome";
import { requestAdd } from "@/features/hoshii/lib/events";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";

/** First run: nothing wanted yet. */
export function HoshiiWelcome({ hasPiggy }: { hasPiggy: boolean }) {
	return (
		<AppWelcome
			app="/hoshii"
			title="Want it, then wait."
			lead="Hoshii sits between wanting something and buying it. A new want cools for a while: a week for small things, two months for big ones. When it has cooled, you decide: keep it, or let it go. The ones you keep are saved for in order, from a Kuroji account."
			steps={[
				{
					title: "Add what you want",
					body: "Paste a shop link and the name, photo and price fill in. On the phone, share from the shop's app.",
				},
				{
					title: "Let it cool, then decide",
					body: "Still want it? It joins the Plan. Not anymore? What it cost counts as saved.",
				},
				hasPiggy
					? {
							title: "The piggy saves for the Plan",
							body: "Its balance covers the Plan from the top. Drag to change what gets money first.",
						}
					: {
							title: "Pick a piggy",
							body: "A Kuroji savings account whose balance pays for the Plan, top first.",
							href: "/settings/hoshii",
							cta: "Pick",
						},
			]}
		>
			<Button className="gap-1.5" aria-keyshortcuts="N" onClick={() => requestAdd()}>
				<HugeiconsIcon icon={Add01Icon} className="size-4" />
				Add a want
			</Button>
		</AppWelcome>
	);
}
