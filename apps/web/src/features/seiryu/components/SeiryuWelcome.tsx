"use client";

import { ProjectDialog } from "@/features/seiryu/components/ProjectDialog";
import { Button } from "@seikatsu/ui";
import { useState } from "react";

const STEPS = [
	{
		title: "Make a project",
		body: "One board per project, starting with Todo, In Progress and Done.",
	},
	{
		title: "Write cards down as they come",
		body: "Add them straight into a column, or press N anywhere on the board.",
	},
	{
		title: "Move them along",
		body: "Drag a card to the next column; checklists, labels and due dates sit inside it.",
	},
];

/** First run: no projects yet. Lead with making one, and say how the board works. */
export function SeiryuWelcome() {
	const [open, setOpen] = useState(false);
	return (
		<section
			aria-labelledby="seiryu-welcome"
			className="max-w-2xl px-4 py-10 pb-28 sm:px-8 md:py-14"
		>
			<h1 id="seiryu-welcome" className="animate-rise text-2xl font-semibold md:text-3xl">
				Your boards start here.
			</h1>
			<p
				className="animate-rise mt-3 max-w-prose text-muted-foreground"
				style={{ "--i": 1 } as React.CSSProperties}
			>
				Seiryu keeps each project on its own kanban board: columns for stages, cards for the work,
				moved along as it gets done.
			</p>
			<div className="animate-rise mt-6" style={{ "--i": 2 } as React.CSSProperties}>
				<Button onClick={() => setOpen(true)}>Create your first project</Button>
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
			<ProjectDialog open={open} onOpenChange={setOpen} />
		</section>
	);
}
