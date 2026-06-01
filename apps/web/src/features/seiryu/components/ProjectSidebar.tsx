"use client";

import { Spinner } from "@/components/Spinner";
import { createProject, deleteProject, updateProject } from "@/features/seiryu/actions/projects";
import { LABEL_COLORS } from "@/features/seiryu/lib/constants";
import { PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Project = {
	id: string;
	name: string;
	color: string | null;
};

interface Props {
	projects: Project[];
	workspaceId: string;
	activeProjectId?: string;
	cardCounts: Record<string, number>;
	onProjectSelect?: () => void;
}

export function ProjectSidebar({ projects, workspaceId, activeProjectId, cardCounts, onProjectSelect }: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [isCreating, setIsCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editColor, setEditColor] = useState<string | null>(null);
	const [, startRename] = useTransition();

	function navigate(projectId: string) {
		onProjectSelect?.();
		startTransition(() => {
			router.push(`/seiryu/${projectId}`);
		});
	}

	function handleRenameStart(projectId: string, currentName: string, currentColor: string | null) {
		setEditName(currentName);
		setEditColor(currentColor);
		setEditingId(projectId);
	}

	function handleRenameCancel() {
		setEditingId(null);
	}

	function handleRenameSubmit(projectId: string, currentName: string, currentColor: string | null) {
		const trimmed = editName.trim();
		setEditingId(null);
		if (!trimmed) return;
		const nameChanged = trimmed !== currentName;
		const colorChanged = editColor !== currentColor;
		if (!nameChanged && !colorChanged) return;
		startRename(async () => {
			const updates: Record<string, string> = { projectId };
			if (nameChanged) updates.name = trimmed;
			if (colorChanged && editColor) updates.color = editColor;
			const result = await updateProject(updates);
			if ("error" in result) toast.error(result.error);
		});
	}

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		const name = newName.trim();
		if (!name) return;
		setIsCreating(true);
		const result = await createProject({ name });
		setIsCreating(false);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		setNewName("");
		toast.success("Project created");
		startTransition(() => {
			router.push(`/seiryu/${result.data.id}`);
		});
	}

	async function handleDelete(projectId: string, projectName: string) {
		if (!confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
		setDeletingId(projectId);
		const result = await deleteProject({ projectId });
		setDeletingId(null);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		toast.success("Project deleted");
		if (activeProjectId === projectId) {
			const next = projects.find((p) => p.id !== projectId);
			startTransition(() => {
				router.push(next ? `/seiryu/${next.id}` : "/seiryu");
			});
		}
	}

	return (
		<div className="flex h-full flex-col gap-1 p-3">
			<p className="mb-1 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
				Projects
			</p>

			{projects.length === 0 && (
				<p className="px-2 py-4 text-sm text-muted-foreground">No projects yet.</p>
			)}

			{projects.map((project) => {
				const isActive = activeProjectId === project.id;
				const isDeleting = deletingId === project.id;
				const isEditingThis = editingId === project.id;
				return (
					<div
						key={project.id}
						className={cn(
							"group flex items-center rounded-md text-sm transition-colors",
							isActive
								? "bg-accent text-accent-foreground"
								: "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
						)}
					>
						{isEditingThis ? (
							<div className="flex flex-1 flex-col gap-1.5 px-2 py-1.5">
								<div className="flex items-center gap-1.5 flex-wrap">
									{LABEL_COLORS.map((c) => (
										<button
											key={c}
											type="button"
											aria-label={c}
											onMouseDown={(e) => { e.preventDefault(); setEditColor(c); }}
											className={cn(
												"h-4 w-4 shrink-0 rounded-full ring-offset-background transition-shadow",
												editColor === c ? "ring-2 ring-ring ring-offset-1" : "hover:ring-2 hover:ring-ring/50 hover:ring-offset-1",
											)}
											style={{ backgroundColor: c }}
										/>
									))}
								</div>
								<input
									autoFocus
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									onBlur={() => handleRenameSubmit(project.id, project.name, project.color)}
									onKeyDown={(e) => {
										if (e.key === "Escape") { e.preventDefault(); handleRenameCancel(); }
										if (e.key === "Enter") { e.preventDefault(); handleRenameSubmit(project.id, project.name, project.color); }
									}}
									className="flex-1 bg-transparent text-sm text-foreground outline-none"
								/>
							</div>
						) : (
							<button
								type="button"
								disabled={isActive}
								className="flex flex-1 items-center gap-2 px-2 py-1.5 cursor-pointer disabled:cursor-default select-none"
								onClick={() => navigate(project.id)}
								onDoubleClick={() => handleRenameStart(project.id, project.name, project.color)}
							>
								<span
									className="h-2.5 w-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: project.color ?? "#6366f1" }}
								/>
								<span className="flex-1 truncate text-left">{project.name}</span>
								{(cardCounts[project.id] ?? 0) > 0 && (
									<span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
										{cardCounts[project.id]}
									</span>
								)}
							</button>
						)}
						{!isEditingThis && (
							isDeleting ? (
								<span className="pr-2">
									<Spinner className="h-3.5 w-3.5" />
								</span>
							) : (
								<div className="mr-1 hidden group-hover:flex items-center gap-0.5">
									<button
										type="button"
										className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
										onClick={() => handleRenameStart(project.id, project.name, project.color)}
										aria-label={`Edit ${project.name}`}
									>
										<HugeiconsIcon icon={PencilEdit01Icon} className="h-3 w-3" />
									</button>
									<button
										type="button"
										className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
										onClick={() => handleDelete(project.id, project.name)}
										aria-label={`Delete ${project.name}`}
									>
										×
									</button>
								</div>
							)
						)}
					</div>
				);
			})}

			<form onSubmit={handleCreate} className="mt-2 flex flex-col gap-1">
				<input
					type="text"
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					placeholder="New project…"
					className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				/>
				<button
					type="submit"
					disabled={isCreating || !newName.trim()}
					className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
				>
					{isCreating && <Spinner className="h-3.5 w-3.5" />}
					{isCreating ? "Creating…" : "Create project"}
				</button>
			</form>
		</div>
	);
}
