"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { Spinner } from "@/components/Spinner";
import {
	Alert01Icon,
	CheckmarkCircle02Icon,
	Delete01Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	cn,
} from "@seikatsu/ui";
import { format } from "date-fns";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ResumeFile, getApplications } from "../actions/applications";
import {
	type StageField,
	deleteApplication,
	updateApplicationStage,
	updateApplicationStatus,
} from "../actions/applications";
import { type KyuuStatus, kyuuStatusValues } from "../lib/kyuu-schemas";
import { isIgnored } from "../lib/status";
import { EditApplicationModal } from "./EditApplicationModal";
import { KyuuFilterBar } from "./KyuuFilterBar";
import { StatusBadge } from "./StatusBadge";

type Application = Awaited<ReturnType<typeof getApplications>>["rows"][number];

function fmtDate(iso: string, short = false): string {
	return format(new Date(`${iso}T00:00:00`), short ? "MMM d" : "MMM d, yyyy");
}

function Check({ done, onClick }: { done: boolean; onClick?: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex cursor-pointer items-center justify-center rounded-md p-1 transition-colors hover:bg-muted/80 focus:outline-hidden"
			title={done ? "Mark stage as incomplete" : "Mark stage as complete"}
		>
			{done ? (
				<HugeiconsIcon
					icon={CheckmarkCircle02Icon}
					className="h-4 w-4 text-emerald-500 transition-transform hover:scale-110"
				/>
			) : (
				<span className="text-xs font-medium text-muted-foreground/40 transition-colors hover:text-foreground">
					—
				</span>
			)}
		</button>
	);
}

const SORTABLE_COLUMNS = ["date", "company", "status"] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

interface Props {
	applications: Application[];
	sources: string[];
	resumeFiles: ResumeFile[];
	hasFilters: boolean;
	sortField: SortColumn;
	sortDir: "asc" | "desc";
	/** 0-based. */
	page: number;
	pageCount: number;
}

type OptimisticUpdate =
	| { type: "update"; id: string; changes: Partial<Application> }
	| { type: "delete"; id: string };

interface RowProps {
	app: Application;
	onStatusChange: (id: string, status: KyuuStatus) => void;
	onStageToggle: (id: string, stage: StageField, currentValue: boolean) => void;
	onEdit: (app: Application) => void;
	onDelete: (app: Application) => void;
}

// Field-wise equality: after a server re-render every row object is new, but only rows whose
// data actually changed need to re-render (a 200+ row table otherwise repaints on every click).
function sameApplication(a: Application, b: Application): boolean {
	if (a === b) return true;
	for (const key of Object.keys(a) as (keyof Application)[]) {
		if (a[key] !== b[key]) return false;
	}
	return true;
}

const ApplicationRow = memo(
	function ApplicationRow({ app, onStatusChange, onStageToggle, onEdit, onDelete }: RowProps) {
		return (
			<TableRow>
				<TableCell className="text-muted-foreground whitespace-nowrap">
					<span className="sm:hidden">{fmtDate(app.dateApplied, true)}</span>
					<span className="hidden sm:inline">{fmtDate(app.dateApplied)}</span>
				</TableCell>
				<TableCell className="max-w-0 w-full font-medium sm:max-w-[180px] sm:w-auto">
					<div className="truncate" title={app.company}>
						{app.company}
					</div>
					<div className="truncate text-xs font-normal text-muted-foreground sm:hidden">
						{app.role}
					</div>
				</TableCell>
				<TableCell className="hidden max-w-0 w-full sm:table-cell">
					{app.jobUrl ? (
						<a
							href={app.jobUrl}
							target="_blank"
							rel="noopener noreferrer"
							title={app.role}
							className="block truncate hover:underline underline-offset-2"
						>
							{app.role}
						</a>
					) : (
						<div className="truncate" title={app.role}>
							{app.role}
						</div>
					)}
				</TableCell>
				<TableCell className="hidden text-muted-foreground whitespace-nowrap sm:table-cell">
					{app.source ?? "—"}
				</TableCell>
				<TableCell className="hidden max-w-[140px] text-muted-foreground whitespace-nowrap md:table-cell">
					{app.resumeFileUrl ? (
						<a
							href={app.resumeFileUrl}
							target="_blank"
							rel="noopener noreferrer"
							download={app.resumeFileName ?? undefined}
							title={app.resumeFileName ?? undefined}
							className="block truncate hover:underline underline-offset-2"
						>
							{app.resumeFileName ?? "Resume"}
						</a>
					) : (
						"—"
					)}
				</TableCell>
				<TableCell className="whitespace-nowrap">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="inline-flex cursor-pointer transition-opacity hover:opacity-80 focus:outline-hidden"
							>
								<StatusBadge status={isIgnored(app) ? "ignored" : app.status} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{kyuuStatusValues.map((s) => (
								<DropdownMenuItem
									key={s}
									disabled={app.status === s}
									onSelect={() => onStatusChange(app.id, s)}
									className="cursor-pointer"
								>
									<StatusBadge status={s} />
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</TableCell>
				<TableCell className="hidden text-center sm:table-cell">
					<Check
						done={app.hrScreening}
						onClick={() => onStageToggle(app.id, "hrScreening", app.hrScreening)}
					/>
				</TableCell>
				<TableCell className="hidden text-center sm:table-cell">
					<Check
						done={app.technicalInterview}
						onClick={() => onStageToggle(app.id, "technicalInterview", app.technicalInterview)}
					/>
				</TableCell>
				<TableCell className="hidden text-center sm:table-cell">
					<Check done={app.offer} onClick={() => onStageToggle(app.id, "offer", app.offer)} />
				</TableCell>
				<TableCell>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
								<span className="sr-only">Open menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={() => onEdit(app)}>
								<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onSelect={() => onDelete(app)}
							>
								<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</TableCell>
			</TableRow>
		);
	},
	(prev, next) =>
		sameApplication(prev.app, next.app) &&
		prev.onStatusChange === next.onStatusChange &&
		prev.onStageToggle === next.onStageToggle &&
		prev.onEdit === next.onEdit &&
		prev.onDelete === next.onDelete,
);

export function ApplicationsTable({
	applications,
	sources,
	resumeFiles,
	hasFilters,
	sortField,
	sortDir,
	page,
	pageCount,
}: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isDeleting, startDeleteTransition] = useTransition();
	const [, startTransition] = useTransition();
	const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
	const [editTarget, setEditTarget] = useState<Application | null>(null);

	const [optimisticApplications, setOptimisticApplications] = useOptimistic(
		applications,
		(state, update: OptimisticUpdate) => {
			if (update.type === "delete") {
				return state.filter((a) => a.id !== update.id);
			}
			return state.map((a) => (a.id === update.id ? { ...a, ...update.changes } : a));
		},
	);

	function sortBy(field: SortColumn) {
		const params = new URLSearchParams(searchParams.toString());
		if (sortField === field) {
			params.set("dir", sortDir === "asc" ? "desc" : "asc");
		} else {
			params.set("sort", field);
			params.delete("dir");
		}
		params.delete("page");
		startNavigationProgress();
		router.push(`${pathname}?${params.toString()}`);
	}

	function pageHref(target: number) {
		const params = new URLSearchParams(searchParams.toString());
		if (target === 0) params.delete("page");
		else params.set("page", String(target));
		const qs = params.toString();
		return qs ? `${pathname}?${qs}` : pathname;
	}

	function sortIndicator(field: SortColumn) {
		return sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "↕";
	}

	// Inline edits apply optimistically; the action's re-render confirms them. Only errors toast.
	const handleStatusChange = useCallback(
		(id: string, newStatus: KyuuStatus) => {
			startTransition(async () => {
				setOptimisticApplications({ type: "update", id, changes: { status: newStatus } });
				const result = await updateApplicationStatus(id, newStatus);
				if ("error" in result) toast.error(result.error);
			});
		},
		[setOptimisticApplications],
	);

	const handleStageToggle = useCallback(
		(id: string, stage: StageField, currentValue: boolean) => {
			startTransition(async () => {
				const nextValue = !currentValue;
				setOptimisticApplications({ type: "update", id, changes: { [stage]: nextValue } });
				const result = await updateApplicationStage(id, stage, nextValue);
				if ("error" in result) toast.error(result.error);
			});
		},
		[setOptimisticApplications],
	);

	const handleEdit = useCallback((app: Application) => setEditTarget(app), []);
	const handleDeleteRequest = useCallback((app: Application) => setDeleteTarget(app), []);

	function handleDelete(id: string) {
		startDeleteTransition(async () => {
			setOptimisticApplications({ type: "delete", id });
			const result = await deleteApplication(id);
			if ("error" in result) {
				toast.error(result.error);
			} else {
				toast.success("Application deleted.");
			}
			setDeleteTarget(null);
		});
	}

	return (
		<section>
			<div className="mb-4">
				<KyuuFilterBar sources={sources} />
			</div>
			<div className="overflow-x-auto rounded-lg border">
				<Table className="min-w-0 sm:min-w-[860px]">
					<TableHeader>
						<TableRow>
							<TableHead className="whitespace-nowrap">
								<button
									type="button"
									className="flex items-center gap-1 hover:text-foreground"
									onClick={() => sortBy("date")}
								>
									Date
									<span className="text-muted-foreground/60">{sortIndicator("date")}</span>
								</button>
							</TableHead>
							<TableHead className="w-full sm:w-auto">
								<button
									type="button"
									className="flex items-center gap-1 hover:text-foreground"
									onClick={() => sortBy("company")}
								>
									Company
									<span className="text-muted-foreground/60">{sortIndicator("company")}</span>
								</button>
							</TableHead>
							<TableHead className="hidden w-full sm:table-cell">Role</TableHead>
							<TableHead className="hidden whitespace-nowrap sm:table-cell">Source</TableHead>
							<TableHead className="hidden whitespace-nowrap md:table-cell">Resume</TableHead>
							<TableHead className="whitespace-nowrap">
								<button
									type="button"
									className="flex items-center gap-1 hover:text-foreground"
									onClick={() => sortBy("status")}
								>
									Status
									<span className="text-muted-foreground/60">{sortIndicator("status")}</span>
								</button>
							</TableHead>
							<TableHead className="hidden text-center sm:table-cell">HR</TableHead>
							<TableHead className="hidden text-center sm:table-cell">Tech</TableHead>
							<TableHead className="hidden text-center sm:table-cell">Offer</TableHead>
							<TableHead className="w-10" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{optimisticApplications.length === 0 ? (
							<TableRow>
								<TableCell colSpan={10} className="py-12 text-center">
									<p className="text-sm font-medium text-muted-foreground">
										{hasFilters ? "No applications match these filters" : "No applications yet"}
									</p>
									{!hasFilters && (
										<p className="mt-1 text-xs text-muted-foreground">
											Use the Add Application button to log your first one.
										</p>
									)}
								</TableCell>
							</TableRow>
						) : (
							optimisticApplications.map((app) => (
								<ApplicationRow
									key={app.id}
									app={app}
									onStatusChange={handleStatusChange}
									onStageToggle={handleStageToggle}
									onEdit={handleEdit}
									onDelete={handleDeleteRequest}
								/>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{pageCount > 1 && (
				<div className="flex items-center justify-between gap-2 pt-3 text-sm">
					{page > 0 ? (
						<Button asChild variant="outline" size="sm">
							<Link href={pageHref(page - 1)} prefetch scroll={false}>
								Previous
							</Link>
						</Button>
					) : (
						<Button variant="outline" size="sm" disabled>
							Previous
						</Button>
					)}
					<span className="text-muted-foreground tabular-nums">
						Page {page + 1} of {pageCount}
					</span>
					{page + 1 < pageCount ? (
						<Button asChild variant="outline" size="sm">
							<Link href={pageHref(page + 1)} prefetch scroll={false}>
								Next
							</Link>
						</Button>
					) : (
						<Button variant="outline" size="sm" disabled>
							Next
						</Button>
					)}
				</div>
			)}

			<AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<HugeiconsIcon icon={Alert01Icon} className="h-5 w-5 text-destructive" />
							Delete application?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Permanently deletes this application. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={isDeleting}
							onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
						>
							{isDeleting ? <Spinner /> : <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />}
							{isDeleting ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{editTarget && (
				<EditApplicationModal
					application={editTarget}
					sources={sources}
					resumeFiles={resumeFiles}
					open={!!editTarget}
					onOpenChange={(v) => {
						if (!v) setEditTarget(null);
					}}
				/>
			)}
		</section>
	);
}
