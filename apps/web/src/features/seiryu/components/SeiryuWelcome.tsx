"use client";

import { AppWelcome } from "@/components/AppWelcome";
import { Spinner } from "@/components/Spinner";
import { createProject } from "@/features/seiryu/actions/projects";
import { LABEL_COLORS } from "@/lib/pigments";
import { Button, Input } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const STEPS = [
	{
		title: "Name a project",
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

const IDEAS = ["Home", "Work", "Side project", "Trip"];

/** First run: no projects yet. Name the first one right here; its board opens next. */
export function SeiryuWelcome() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [isSaving, startSave] = useTransition();

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		startSave(async () => {
			const result = await createProject({ name: trimmed, color: LABEL_COLORS[0]?.hex });
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			router.push(`/seiryu/${result.data.id}`);
		});
	}

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<AppWelcome
				app="/seiryu"
				title="Your boards start here."
				lead="Seiryu keeps each project on its own kanban board: columns for stages, cards for the work, moved along as it gets done."
				steps={STEPS}
			>
				<form onSubmit={handleSubmit} className="flex max-w-md gap-2">
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Name your first project"
						aria-label="Project name"
						maxLength={100}
					/>
					<Button type="submit" disabled={isSaving || !name.trim()} className="gap-1.5">
						{isSaving && <Spinner />}
						{isSaving ? "Creating…" : "Create"}
					</Button>
				</form>
				<div className="mt-3 flex flex-wrap gap-1.5">
					{IDEAS.map((idea) => (
						<Button
							key={idea}
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setName(idea)}
						>
							{idea}
						</Button>
					))}
				</div>
			</AppWelcome>
		</div>
	);
}
