"use client";

import { Spinner } from "@/components/Spinner";
import { useRefreshRouter } from "@/hooks/useRefreshRouter";
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
} from "@seikatsu/ui";
import { format } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ResumeFile, getApplications } from "../actions/applications";
import { deleteApplication } from "../actions/applications";
import { isIgnored } from "../lib/status";
import { EditApplicationModal } from "./EditApplicationModal";
import { KyuuFilterBar } from "./KyuuFilterBar";
import { StatusBadge } from "./StatusBadge";

type Application = Awaited<ReturnType<typeof getApplications>>[number];

function fmtDate(iso: string, short = false): string {
	return format(new Date(`${iso}T00:00:00`), short ? "MMM d" : "MMM d, yyyy");
}

function Check({ done }: { done: boolean }) {
	return done ? (
		<HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-emerald-500" />
	) : (
		<span className="text-muted-foreground/40">—</span>
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
}

export function ApplicationsTable({
	applications,
	sources,
	resumeFiles,
	hasFilters,
	sortField,
	sortDir,
}: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const refresh = useRefreshRouter();
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [editTarget, setEditTarget] = useState<Application | null>(null);

	function sortBy(field: SortColumn) {
		const params = new URLSearchParams(searchParams.toString());
		if (sortField === field) {
			params.set("dir", sortDir === "asc" ? "desc" : "asc");
		} else {
			params.set("sort", field);
			params.delete("dir");
		}
		router.push(`${pathname}?${params.toString()}`);
	}

	function sortIndicator(field: SortColumn) {
		return sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "↕";
	}

	function handleDelete(id: string) {
		startTransition(async () => {
			const result = await deleteApplication(id);
			if ("error" in result) {
				toast.error(result.error);
			} else {
				toast.success("Application deleted.");
				refresh();
			}
			setPendingId(null);
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
						{applications.length === 0 ? (
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
							applications.map((app) => (
								<TableRow key={app.id}>
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
										<StatusBadge status={isIgnored(app) ? "ignored" : app.status} />
									</TableCell>
									<TableCell className="hidden text-center sm:table-cell">
										<Check done={app.hrScreening} />
									</TableCell>
									<TableCell className="hidden text-center sm:table-cell">
										<Check done={app.technicalInterview} />
									</TableCell>
									<TableCell className="hidden text-center sm:table-cell">
										<Check done={app.offer} />
									</TableCell>
									<TableCell>
										<AlertDialog
											open={pendingId === app.id}
											onOpenChange={(v) => !v && setPendingId(null)}
										>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="ghost" size="icon" className="h-8 w-8">
														<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
														<span className="sr-only">Open menu</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem onSelect={() => setEditTarget(app)}>
														<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
														Edit
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onSelect={() => setPendingId(app.id)}
													>
														<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle className="flex items-center gap-2">
														<HugeiconsIcon
															icon={Alert01Icon}
															className="h-5 w-5 text-destructive"
														/>
														Delete application?
													</AlertDialogTitle>
													<AlertDialogDescription>
														Permanently deletes this application. This action cannot be undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
													<AlertDialogAction
														className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
														disabled={isPending}
														onClick={() => handleDelete(app.id)}
													>
														{isPending ? (
															<Spinner />
														) : (
															<HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
														)}
														{isPending ? "Deleting…" : "Delete"}
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

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
