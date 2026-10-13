"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ContextArea } from "@/components/ContextArea";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { deleteProject, reorderProject } from "@/features/seiryu/actions/projects";
import { ProjectDialog, type ProjectSummary } from "@/features/seiryu/components/ProjectDialog";
import { useServerState } from "@/features/seiryu/lib/server-state";
import { generateKeyBetween } from "@/lib/position";
import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	type Modifier,
	MouseSensor,
	TouchSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Add01Icon,
	Delete01Icon,
	FolderOpenIcon,
	LinkSquare02Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	ContextMenuItem,
	ContextMenuSeparator,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Project = ProjectSummary & { position: string };

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });
const SORT_TRANSITION = { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };

interface Props {
	projects: Project[];
	activeProjectId?: string;
	cardCounts: Record<string, number>;
	/** Phones: the list lives in a sheet that closes once a project is picked. */
	onNavigate?: () => void;
}

/**
 * The projects, as the rail lists apps: the open one lit by a pigment pill that travels to
 * the next pick. Drag a row to reorder; edit and delete sit in each row's menu.
 */
export function ProjectList({
	projects: serverProjects,
	activeProjectId,
	cardCounts,
	onNavigate,
}: Props) {
	const router = useRouter();
	const dndId = useId();
	const { state: projects, setState, track, reset } = useServerState(serverProjects);
	const [dialog, setDialog] = useState<{ open: boolean; project: ProjectSummary | null }>({
		open: false,
		project: null,
	});
	const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
	const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
	const menuProject = menuProjectId ? projects.find((p) => p.id === menuProjectId) : undefined;
	// The tapped project, lit before its board arrives.
	const [pendingId, setPendingId] = useState<string | null>(null);
	const litId = pendingId && pendingId !== activeProjectId ? pendingId : activeProjectId;
	useLayoutEffect(() => setPendingId(null), [activeProjectId]);

	const sorted = useMemo(
		() => [...projects].sort((a, b) => (a.position < b.position ? -1 : 1)),
		[projects],
	);

	// Mouse drags after 5px; touch after a 250ms press so the list still scrolls.
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	// One pill travels to the lit row, so switching projects reads as going somewhere.
	const listRef = useRef<HTMLUListElement>(null);
	const [pill, setPill] = useState<{ y: number; h: number; moved: boolean } | null>(null);
	useLayoutEffect(() => {
		const row = litId
			? listRef.current?.querySelector<HTMLElement>(`[data-project-id="${litId}"]`)
			: null;
		setPill((prev) =>
			row ? { y: row.offsetTop, h: row.offsetHeight, moved: prev !== null } : null,
		);
	}, [litId, sorted]);

	function handleDragEnd({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id) return;
		const oldIdx = sorted.findIndex((p) => p.id === active.id);
		const newIdx = sorted.findIndex((p) => p.id === over.id);
		if (oldIdx === -1 || newIdx === -1) return;
		const reordered = arrayMove(sorted, oldIdx, newIdx);
		const newPosition = generateKeyBetween(
			reordered[newIdx - 1]?.position ?? null,
			reordered[newIdx + 1]?.position ?? null,
		);
		const projectId = active.id as string;
		setState((prev) => prev.map((p) => (p.id === projectId ? { ...p, position: newPosition } : p)));
		track(reorderProject({ projectId, newPosition })).then((result) => {
			if ("error" in result) {
				toast.error(result.error);
				reset();
			}
		});
	}

	async function handleDelete(project: ProjectSummary) {
		const result = await deleteProject({ projectId: project.id });
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		if (activeProjectId === project.id) {
			const next = sorted.find((p) => p.id !== project.id);
			router.push(next ? `/seiryu/${next.id}` : "/seiryu");
		}
	}

	return (
		<nav aria-labelledby={`${dndId}-title`} className="flex flex-col gap-2">
			<div className="flex h-10 items-center justify-between pl-2 md:h-8">
				<h2 id={`${dndId}-title`} className="text-sm font-medium">
					Projects
				</h2>
				<Button
					variant="ghost"
					size="icon"
					className="size-10 text-muted-foreground hover:text-foreground md:size-8"
					aria-label="New project"
					onClick={() => setDialog({ open: true, project: null })}
				>
					<HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
				</Button>
			</div>

			{sorted.length === 0 ? (
				<p className="px-2 text-sm text-muted-foreground">
					No projects yet.{" "}
					<button
						type="button"
						onClick={() => setDialog({ open: true, project: null })}
						className="text-foreground underline-offset-4 hover:underline"
					>
						Create one
					</button>
				</p>
			) : (
				<DndContext
					id={dndId}
					sensors={sensors}
					collisionDetection={closestCenter}
					modifiers={[restrictToVerticalAxis]}
					onDragEnd={handleDragEnd}
				>
					<SortableContext items={sorted.map((p) => p.id)} strategy={verticalListSortingStrategy}>
						<ContextArea
							attr="data-project-id"
							onTarget={(projectId) => {
								setMenuProjectId(projectId);
								return true;
							}}
							menu={
								menuProject && (
									<>
										<ContextMenuItem
											onSelect={() => {
												setPendingId(menuProject.id);
												onNavigate?.();
												startNavigationProgress();
												router.push(`/seiryu/${menuProject.id}`);
											}}
										>
											<HugeiconsIcon icon={FolderOpenIcon} />
											Open
										</ContextMenuItem>
										{/* The browser's own link menu gives way to this one. */}
										<ContextMenuItem
											onSelect={() =>
												window.open(`/seiryu/${menuProject.id}`, "_blank", "noopener")
											}
										>
											<HugeiconsIcon icon={LinkSquare02Icon} />
											Open in new tab
										</ContextMenuItem>
										<ContextMenuItem
											onSelect={() => setDialog({ open: true, project: menuProject })}
										>
											<HugeiconsIcon icon={PencilEdit01Icon} />
											Edit
										</ContextMenuItem>
										<ContextMenuSeparator />
										<ContextMenuItem
											className="text-destructive focus:text-destructive"
											onSelect={() => setDeleting(menuProject)}
										>
											<HugeiconsIcon icon={Delete01Icon} />
											Delete…
										</ContextMenuItem>
									</>
								)
							}
						>
							<ul ref={listRef} className="relative">
								{pill && (
									<span
										aria-hidden
										className={cn(
											"pointer-events-none absolute inset-x-0 top-0 rounded-md bg-primary/15",
											pill.moved &&
												"transition-[transform,height] duration-300 ease-in-out motion-reduce:transition-none",
										)}
										style={{ transform: `translateY(${pill.y}px)`, height: pill.h }}
									/>
								)}
								{sorted.map((project) => (
									<ProjectRow
										key={project.id}
										project={project}
										lit={project.id === litId}
										count={cardCounts[project.id] ?? 0}
										onPick={() => {
											setPendingId(project.id);
											onNavigate?.();
										}}
										onEdit={() => setDialog({ open: true, project })}
										onDelete={() => setDeleting(project)}
									/>
								))}
							</ul>
						</ContextArea>
					</SortableContext>
				</DndContext>
			)}

			<ProjectDialog
				open={dialog.open}
				project={dialog.project}
				count={sorted.length}
				onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
			/>
			<ConfirmDelete
				open={!!deleting}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete "${deleting?.name ?? ""}"?`}
				description="Its board, every card, checklist and label go for good. This can't be undone."
				onConfirm={() => (deleting ? handleDelete(deleting) : undefined)}
			/>
		</nav>
	);
}

function ProjectRow({
	project,
	lit,
	count,
	onPick,
	onEdit,
	onDelete,
}: {
	project: Project;
	lit: boolean;
	count: number;
	onPick: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: project.id,
		transition: SORT_TRANSITION,
	});
	// dnd-kit marks the handle role="button"; this one is a link and must stay one.
	const { role: _role, ...sortable } = attributes;
	// A drag ends with a click on the link under the pointer: that one must not navigate.
	const dragged = useRef(false);
	if (isDragging) dragged.current = true;

	return (
		<li
			ref={setNodeRef}
			data-project-id={project.id}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(
				"group relative flex items-center rounded-md",
				isDragging && "z-10 bg-surface-2",
			)}
		>
			<Link
				href={`/seiryu/${project.id}`}
				prefetch
				{...sortable}
				{...listeners}
				aria-current={lit ? "page" : undefined}
				onPointerDownCapture={() => {
					dragged.current = false;
				}}
				onClickCapture={(e) => {
					if (dragged.current) {
						e.preventDefault();
						dragged.current = false;
						return;
					}
					onPick();
				}}
				className={cn(
					"flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md pr-12 pl-2 md:h-9 md:pr-10 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
					lit ? "text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground",
				)}
			>
				<span
					aria-hidden
					className="size-2 shrink-0 rounded-full"
					style={{ backgroundColor: project.color ?? "var(--muted-foreground)" }}
				/>
				<span className="min-w-0 flex-1 truncate">{project.name}</span>
				{count > 0 && (
					<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
						{count}
						<span className="sr-only"> open cards</span>
					</span>
				)}
			</Link>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="absolute right-0.5 size-10 text-muted-foreground/50 md:size-8 hover:text-foreground data-[state=open]:text-foreground"
						aria-label={`Actions for ${project.name}`}
					>
						<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={onEdit}>
						<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
						Edit
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
						<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
						Delete…
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</li>
	);
}
