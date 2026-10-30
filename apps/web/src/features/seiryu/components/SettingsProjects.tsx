"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { deleteProject } from "@/features/seiryu/actions/projects";
import { ProjectDialog, type ProjectSummary } from "@/features/seiryu/components/ProjectDialog";
import { Delete01Icon, MoreHorizontalIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

type Row = ProjectSummary & { openCards: number };

export function NewProjectButton({ count }: { count: number }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button variant="outline" onClick={() => setOpen(true)}>
				New Project
			</Button>
			<ProjectDialog open={open} onOpenChange={setOpen} count={count} />
		</>
	);
}

/** Every project as a hairline row: open its board, or edit and delete from the row menu. */
export function SettingsProjects({ projects }: { projects: Row[] }) {
	const [editing, setEditing] = useState<ProjectSummary | null>(null);
	const [deleting, setDeleting] = useState<ProjectSummary | null>(null);

	if (projects.length === 0) {
		return <p className="py-4 text-sm text-muted-foreground">No projects yet.</p>;
	}

	return (
		<>
			<ul className="divide-y divide-rule">
				{projects.map((p, i) => (
					<li
						key={p.id}
						className="animate-rise group relative flex items-center gap-3 py-2.5 transition-colors hover:bg-surface"
						style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
					>
						<span
							aria-hidden
							className="size-2 shrink-0 rounded-full"
							style={{ backgroundColor: p.color ?? "var(--muted-foreground)" }}
						/>
						<Link
							href={`/seiryu/${p.id}`}
							prefetch
							className="min-w-0 flex-1 truncate text-sm after:absolute after:inset-0"
						>
							{p.name}
						</Link>
						<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
							{p.openCards} open
						</span>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="relative size-10 text-muted-foreground/50 md:size-8 hover:text-foreground"
									aria-label={`Actions for ${p.name}`}
								>
									<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setEditing(p)}>
									<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onClick={() => setDeleting(p)}
								>
									<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
									Delete…
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</li>
				))}
			</ul>
			<ProjectDialog
				open={!!editing}
				project={editing}
				onOpenChange={(open) => !open && setEditing(null)}
			/>
			<ConfirmDelete
				open={!!deleting}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete "${deleting?.name ?? ""}"?`}
				description="Its board, every card, checklist and label go for good. This can't be undone."
				onConfirm={async () => {
					if (!deleting) return;
					const result = await deleteProject({ projectId: deleting.id });
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</>
	);
}
