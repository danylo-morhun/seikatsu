"use client";

import { Button, Input } from "@seikatsu/ui";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { QUEUED_TOAST } from "@/features/pwa/lib/run";
import { addCard } from "@/features/seiryu/lib/offline";

export type GoalStepData =
	| { kind: "card"; title: string; href: string; note: string }
	| { kind: "add"; projectId: string; columnId: string; projectName: string };

/**
 * A goal's next step: the first open card of its project, or — when there's none — a line to
 * add one there, so a goal is never left without something to do next.
 */
export function GoalStep({ goalName, step }: { goalName: string; step: GoalStepData }) {
	const id = useId();
	const [title, setTitle] = useState("");
	const [added, setAdded] = useState<string | null>(null);
	const [saving, startSaving] = useTransition();

	if (step.kind === "card" || added)
		return (
			<p className="flex items-baseline gap-2 rounded-field bg-primary/10 px-3 py-2 text-sm">
				<span className="shrink-0 text-xs font-medium text-primary">Next</span>
				{step.kind === "card" ? (
					<Link href={step.href} prefetch className="min-w-0 flex-1 truncate hover:underline">
						{step.title}
						{step.note && <span className="text-muted-foreground"> · {step.note}</span>}
					</Link>
				) : (
					<span className="min-w-0 flex-1 truncate">{added}</span>
				)}
			</p>
		);

	return (
		<form
			className="space-y-2 rounded-field border border-dashed border-border p-3"
			onSubmit={(e) => {
				e.preventDefault();
				const text = title.trim();
				if (!text) return;
				startSaving(async () => {
					const result = await addCard(
						crypto.randomUUID(),
						step.columnId,
						step.projectId,
						text,
					).catch(() => ({ error: "Couldn't save. Check your connection." }));
					if ("error" in result) {
						toast.error(result.error);
						return;
					}
					toast("queued" in result ? QUEUED_TOAST : "Next step added", { description: text });
					setAdded(text);
				});
			}}
		>
			<label htmlFor={id} className="block text-xs text-muted-foreground">
				No next step. What moves “{goalName}” forward? It goes to {step.projectName}.
			</label>
			<div className="flex gap-2">
				<Input
					id={id}
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="The next thing to do"
					autoComplete="off"
				/>
				<Button
					type="submit"
					variant="outline"
					disabled={saving || !title.trim()}
					className="gap-1.5"
				>
					{saving && <Spinner />}
					Add
				</Button>
			</div>
		</form>
	);
}
