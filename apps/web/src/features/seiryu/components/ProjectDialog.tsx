"use client";

import { Spinner } from "@/components/Spinner";
import { createProject, updateProject } from "@/features/seiryu/actions/projects";
import { ColorSwatches } from "@/features/seiryu/components/ColorSwatches";
import { LABEL_COLORS } from "@/features/seiryu/lib/constants";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

export type ProjectSummary = { id: string; name: string; color: string | null };

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Given: edit this project. Absent: create one (and open its board). */
	project?: ProjectSummary | null;
	/** How many projects exist: a new one takes the next pigment. */
	count?: number;
}

export function ProjectDialog({ open, onOpenChange, project, count = 0 }: Props) {
	const id = useId();
	const router = useRouter();
	const [name, setName] = useState("");
	const [color, setColor] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();

	// Every open starts from the project (or a blank form with the next pigment).
	useEffect(() => {
		if (!open) return;
		setName(project?.name ?? "");
		setColor(project?.color ?? LABEL_COLORS[count % LABEL_COLORS.length]?.hex ?? null);
	}, [open, project, count]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		startSave(async () => {
			if (project) {
				const result = await updateProject({
					projectId: project.id,
					name: trimmed,
					...(color ? { color } : {}),
				});
				if ("error" in result) {
					toast.error(result.error);
					return;
				}
				onOpenChange(false);
				return;
			}
			const result = await createProject({ name: trimmed, ...(color ? { color } : {}) });
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			onOpenChange(false);
			router.push(`/seiryu/${result.data.id}`);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent className="sm:max-w-md max-sm:flex max-sm:flex-col">
				<DialogHeader>
					<DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
					<DialogDescription className="sr-only">
						{project
							? "Rename the project or change its colour."
							: "A project is one board: it starts with Todo, In Progress and Done."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-name`}>Name</Label>
						<Input
							id={`${id}-name`}
							value={name}
							maxLength={100}
							autoComplete="off"
							placeholder="e.g. Website relaunch"
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label id={`${id}-color`}>Colour</Label>
						<ColorSwatches value={color} onChange={setColor} label="Project colour" />
					</div>
					{!project && (
						<p className="text-sm text-muted-foreground">
							Starts with Todo, In Progress and Done; rename or add columns any time.
						</p>
					)}
					<div className="mt-auto flex justify-end gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4">
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="gap-1.5 max-sm:flex-1"
							disabled={isSaving || !name.trim()}
						>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : project ? "Save" : "Create"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
