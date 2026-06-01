"use client";

import { Spinner } from "@/components/Spinner";
import { createProject, deleteProject, updateProject } from "@/features/seiryu/actions/projects";
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
	onProjectSelect?: () => void;
}

export function ProjectSidebar({ projects, workspaceId, activeProjectId, onProjectSelect }: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [isCreating, setIsCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [, startRename] = useTransition();

	function navigate(projectId: string) {
		onProjectSelect?.();
		startTransition(() => {
			router.push(`/seiryu/${projectId}`);
		});
	}

	function handleRenameStart(projectId: string, currentName: string) {
		setEditName(currentName);
		setEditingId(projectId);
	}

	function handleRenameCancel() {
		setEditingId(null);
	}

	function handleRenameSubmit(projectId: string, currentName: string) {
		const trimmed = editName.trim();
		setEditingId(null);
		if (!trimmed || trimmed === currentName) return;
		startRename(async () => {
			const result = await updateProject({ projectId, name: trimmed });
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
							<div className="flex flex-1 items-center gap-2 px-2 py-1.5">
								<span
									className="h-2.5 w-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: project.color ?? "#6366f1" }}
								/>
								<input
									autoFocus
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									onBlur={() => handleRenameSubmit(project.id, project.name)}
									onKeyDown={(e) => {
										if (e.key === "Escape") { e.preventDefault(); handleRenameCancel(); }
										if (e.key === "Enter") { e.preventDefault(); handleRenameSubmit(project.id, project.name); }
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
								onDoubleClick={() => handleRenameStart(project.id, project.name)}
							>
								<span
									className="h-2.5 w-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: project.color ?? "#6366f1" }}
								/>
								<span className="flex-1 truncate text-left">{project.name}</span>
							</button>
						)}
						{!isEditingThis && (
							isDeleting ? (
								<span className="pr-2">
									<Spinner className="h-3.5 w-3.5" />
								</span>
							) : (
								<button
									type="button"
									className="mr-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
									onClick={() => handleDelete(project.id, project.name)}
									aria-label={`Delete ${project.name}`}
								>
									×
								</button>
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
