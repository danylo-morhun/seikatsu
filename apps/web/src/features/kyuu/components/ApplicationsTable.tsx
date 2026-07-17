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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
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
import type { getApplications } from "../actions/applications";
import { deleteApplication } from "../actions/applications";
import { kyuuStatusValues } from "../lib/kyuu-schemas";
import { EditApplicationModal } from "./EditApplicationModal";
import { STATUS_CONFIG, StatusBadge } from "./StatusBadge";

type Application = Awaited<ReturnType<typeof getApplications>>[number];

function fmtDate(iso: string): string {
	return format(new Date(`${iso}T00:00:00`), "MMM d, yyyy");
}

function Check({ done }: { done: boolean }) {
	return done ? (
		<HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-emerald-500" />
	) : (
		<span className="text-muted-foreground/40">—</span>
	);
}

interface Props {
	applications: Application[];
	sources: string[];
	statusFilter?: string;
}

export function ApplicationsTable({ applications, sources, statusFilter }: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const refresh = useRefreshRouter();
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [editTarget, setEditTarget] = useState<Application | null>(null);

	function filterByStatus(value: string) {
		const params = new URLSearchParams(searchParams.toString());
		if (value === "all") params.delete("status");
		else params.set("status", value);
		router.push(`${pathname}?${params.toString()}`);
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
			<div className="mb-4 flex items-center justify-end">
				<Select value={statusFilter ?? "all"} onValueChange={filterByStatus}>
					<SelectTrigger className="h-8 w-44">
						<SelectValue placeholder="All statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						{kyuuStatusValues.map((s) => (
							<SelectItem key={s} value={s}>
								{STATUS_CONFIG[s].label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="overflow-x-auto rounded-lg border">
				<Table className="min-w-[860px]">
					<TableHeader>
						<TableRow>
							<TableHead className="whitespace-nowrap">Date</TableHead>
							<TableHead>Company</TableHead>
							<TableHead className="w-full">Role</TableHead>
							<TableHead className="whitespace-nowrap">Source</TableHead>
							<TableHead className="whitespace-nowrap">Status</TableHead>
							<TableHead className="text-center">HR</TableHead>
							<TableHead className="text-center">Tech</TableHead>
							<TableHead className="text-center">Offer</TableHead>
							<TableHead className="w-10" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{applications.length === 0 ? (
							<TableRow>
								<TableCell colSpan={9} className="py-12 text-center">
									<p className="text-sm font-medium text-muted-foreground">
										{statusFilter ? "No applications with this status" : "No applications yet"}
									</p>
									{!statusFilter && (
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
										{fmtDate(app.dateApplied)}
									</TableCell>
									<TableCell className="max-w-[180px] font-medium">
										<div className="truncate" title={app.company}>
											{app.company}
										</div>
									</TableCell>
									<TableCell className="max-w-0 w-full">
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
									<TableCell className="text-muted-foreground whitespace-nowrap">
										{app.source ?? "—"}
									</TableCell>
									<TableCell className="whitespace-nowrap">
										<StatusBadge status={app.status} />
									</TableCell>
									<TableCell className="text-center">
										<Check done={app.hrScreening} />
									</TableCell>
									<TableCell className="text-center">
										<Check done={app.technicalInterview} />
									</TableCell>
									<TableCell className="text-center">
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
					open={!!editTarget}
					onOpenChange={(v) => {
						if (!v) setEditTarget(null);
					}}
				/>
			)}
		</section>
	);
}
