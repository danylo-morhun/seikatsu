"use client";

import { Spinner } from "@/components/Spinner";
import { exportTransactionsCsv } from "@/features/kuroji/actions/export";
import { deleteTransaction, deleteTransactions } from "@/features/kuroji/actions/transactions";
import type { RecentTransaction } from "@/features/kuroji/actions/transactions";
import { EditTransactionModal } from "@/features/kuroji/components/EditTransactionModal";
import { parseLocal } from "@/features/kuroji/lib/dates";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { useRefreshRouter } from "@/hooks/useRefreshRouter";
import {
	Alert01Icon,
	Cancel01Icon,
	Delete01Icon,
	Download01Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
	Tag01Icon,
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
	Checkbox,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
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

const thisYear = new Date().getFullYear();

function fmtDate(iso: string): string {
	const d = parseLocal(iso);
	return d.getFullYear() === thisYear ? format(d, "MMM d") : format(d, "MMM d, yyyy");
}

interface Props {
	transactions: RecentTransaction[];
	currency: string;
	workspaceId: string;
	page: number;
	hasMore: boolean;
	total: number;
	accountFilterId?: string;
	accountFilterName?: string;
	tagFilterId?: string;
	tagFilterName?: string;
	searchQuery?: string;
	dateFrom?: string;
	dateTo?: string;
	sortField?: string;
	sortDir?: string;
}

export function TransactionTable({
	transactions,
	currency,
	workspaceId,
	page,
	hasMore,
	total,
	accountFilterId,
	accountFilterName,
	tagFilterId,
	tagFilterName,
	searchQuery,
	dateFrom,
	dateTo,
	sortField = "date",
	sortDir = "desc",
}: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const [isExporting, setIsExporting] = useState(false);
	const refresh = useRefreshRouter();
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [editTarget, setEditTarget] = useState<RecentTransaction | null>(null);
	const [localQuery, setLocalQuery] = useState(searchQuery ?? "");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

	function navigate(newPage: number) {
		const params = new URLSearchParams(searchParams.toString());
		if (newPage === 0) params.delete("page");
		else params.set("page", String(newPage));
		router.push(`${pathname}?${params.toString()}`);
	}

	function filterByAccount(id: string) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("account", id);
		params.delete("page");
		router.push(`${pathname}?${params.toString()}`);
	}

	function clearAccountFilter() {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("account");
		params.delete("page");
		router.push(`${pathname}?${params.toString()}`);
	}

	function filterByTag(id: string) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("tag", id);
		params.delete("page");
		router.push(`${pathname}?${params.toString()}`);
	}

	function clearTagFilter() {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("tag");
		params.delete("page");
		router.push(`${pathname}?${params.toString()}`);
	}

	function submitSearch(value: string) {
		const params = new URLSearchParams(searchParams.toString());
		if (value.trim()) params.set("q", value.trim());
		else params.delete("q");
		params.delete("page");
		router.push(`${pathname}?${params.toString()}`);
	}

	function sortBy(field: string) {
		const params = new URLSearchParams(searchParams.toString());
		if (sortField === field) {
			params.set("dir", sortDir === "asc" ? "desc" : "asc");
		} else {
			params.set("sort", field);
			params.delete("dir");
		}
		params.delete("page");
		router.push(`${pathname}?${params.toString()}`);
	}

	async function handleExport() {
		setIsExporting(true);
		const result = await exportTransactionsCsv(
			workspaceId,
			dateFrom,
			dateTo,
			accountFilterId,
			searchQuery,
		);
		if ("error" in result) {
			toast.error(result.error);
			setIsExporting(false);
			return;
		}
		const blob = new Blob([result.csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `transactions-${dateFrom ?? "all"}-${dateTo ?? "all"}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		setIsExporting(false);
	}

	function handleDelete(id: string) {
		startTransition(async () => {
			const result = await deleteTransaction(id);
			if ("error" in result) {
				toast.error(result.error);
			} else {
				toast.success("Transaction deleted.");
				refresh();
			}
			setPendingId(null);
		});
	}

	function toggleSelect(id: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleSelectAll() {
		if (selectedIds.size === transactions.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(transactions.map((t) => t.id)));
		}
	}

	function handleBulkDelete() {
		const ids = Array.from(selectedIds);
		startTransition(async () => {
			const result = await deleteTransactions(ids, workspaceId);
			if ("error" in result) {
				toast.error(result.error);
			} else {
				toast.success(`${result.deleted} transaction${result.deleted !== 1 ? "s" : ""} deleted.`);
				setSelectedIds(new Set());
				refresh();
			}
			setBulkDeleteOpen(false);
		});
	}

	const totalPages = Math.ceil(total / 10);

	return (
		<section>
			<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="text-lg font-semibold">Transactions</h2>
					{accountFilterId && accountFilterName && (
						<span className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
							{accountFilterName}
							<button
								type="button"
								className="ml-1 text-muted-foreground hover:text-foreground"
								onClick={clearAccountFilter}
							>
								<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
							</button>
						</span>
					)}
					{tagFilterId && tagFilterName && (
						<span className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
							<HugeiconsIcon icon={Tag01Icon} className="h-3 w-3" />
							{tagFilterName}
							<button
								type="button"
								className="ml-1 text-muted-foreground hover:text-foreground"
								onClick={clearTagFilter}
							>
								<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
							</button>
						</span>
					)}
				</div>
				<div className="flex items-center gap-2 sm:ml-auto">
					{selectedIds.size > 0 && (
						<Button
							variant="destructive"
							size="sm"
							className="h-8"
							onClick={() => setBulkDeleteOpen(true)}
						>
							Delete {selectedIds.size} selected
						</Button>
					)}
					<Input
						placeholder="Search transactions…"
						className="h-8 flex-1 text-sm sm:w-52 sm:flex-none"
						value={localQuery}
						onChange={(e) => setLocalQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submitSearch(localQuery);
						}}
					/>
					<Button
						variant="outline"
						size="icon"
						className="h-8 w-8 shrink-0"
						onClick={handleExport}
						disabled={isExporting}
						title="Export CSV"
					>
						{isExporting ? (
							<Spinner />
						) : (
							<HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-10">
								<Checkbox
									checked={transactions.length > 0 && selectedIds.size === transactions.length}
									onCheckedChange={toggleSelectAll}
									aria-label="Select all"
								/>
							</TableHead>
							<TableHead>
								<button
									type="button"
									className="flex items-center gap-1 hover:text-foreground"
									onClick={() => sortBy("date")}
								>
									Date
									<span className="text-muted-foreground/60">
										{sortField === "date" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
									</span>
								</button>
							</TableHead>
							<TableHead className="w-full">Description</TableHead>
							<TableHead>From</TableHead>
							<TableHead>To</TableHead>
							<TableHead className="text-right">
								<button
									type="button"
									className="flex items-center gap-1 hover:text-foreground ml-auto"
									onClick={() => sortBy("amount")}
								>
									Amount
									<span className="text-muted-foreground/60">
										{sortField === "amount" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
									</span>
								</button>
							</TableHead>
							<TableHead className="w-10" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{transactions.length === 0 ? (
							<TableRow>
								<TableCell colSpan={7} className="py-12 text-center">
									<p className="text-sm font-medium text-muted-foreground">
										{searchQuery
											? `No transactions matching "${searchQuery}"`
											: "No transactions yet"}
									</p>
									{!searchQuery && (
										<p className="mt-1 text-xs text-muted-foreground">
											Use the New Transaction button to record your first entry.
										</p>
									)}
								</TableCell>
							</TableRow>
						) : (
							transactions.map((txn) => (
								<TableRow key={txn.id} className={selectedIds.has(txn.id) ? "bg-muted/40" : ""}>
									<TableCell>
										<Checkbox
											checked={selectedIds.has(txn.id)}
											onCheckedChange={() => toggleSelect(txn.id)}
											aria-label="Select row"
										/>
									</TableCell>
									<TableCell className="text-muted-foreground">{fmtDate(txn.date)}</TableCell>
									<TableCell className="max-w-0 w-full font-medium">
										<div className="truncate">{txn.description ?? "—"}</div>
										{txn.tags.length > 0 && (
											<div className="mt-1 flex flex-wrap gap-1">
												{txn.tags.map((tag) => (
													<button
														key={tag.id}
														type="button"
														title={`Filter by tag: ${tag.name}`}
														onClick={() => filterByTag(tag.id)}
														className="rounded-full border px-1.5 py-px text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
														style={
															tag.color ? { borderColor: tag.color, color: tag.color } : undefined
														}
													>
														{tag.name}
													</button>
												))}
											</div>
										)}
									</TableCell>
									<TableCell>
										<button
											type="button"
											title="Filter by this account"
											className={`group flex items-center gap-1 text-sm hover:underline underline-offset-2 ${accountFilterId === txn.fromAccountId ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
											onClick={() => filterByAccount(txn.fromAccountId)}
										>
											{txn.fromAccount}
										</button>
									</TableCell>
									<TableCell>
										<button
											type="button"
											title="Filter by this account"
											className={`group flex items-center gap-1 text-sm hover:underline underline-offset-2 ${accountFilterId === txn.toAccountId ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
											onClick={() => filterByAccount(txn.toAccountId)}
										>
											{txn.toAccount}
										</button>
									</TableCell>
									<TableCell className="text-right">
										{txn.currency && txn.currency !== currency ? (
											<div>
												<p className="font-mono font-medium">
													{formatCurrency(Number(txn.amount), txn.currency)}
												</p>
												<p className="text-xs text-muted-foreground tabular-nums">
													≈ {formatCurrency(Number(txn.baseAmount), currency)}
												</p>
											</div>
										) : (
											<span className="font-mono font-medium">
												{formatCurrency(Number(txn.baseAmount), currency)}
											</span>
										)}
									</TableCell>
									<TableCell>
										<AlertDialog
											open={pendingId === txn.id}
											onOpenChange={(open) => !open && setPendingId(null)}
										>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="ghost" size="icon" className="h-8 w-8">
														<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
														<span className="sr-only">Open menu</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem onSelect={() => setEditTarget(txn)}>
														<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
														Edit
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onSelect={() => setPendingId(txn.id)}
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
														Delete transaction?
													</AlertDialogTitle>
													<AlertDialogDescription>
														Your account balances will be updated. This action cannot be undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
													<AlertDialogAction
														className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
														disabled={isPending}
														onClick={() => handleDelete(txn.id)}
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
			{(page > 0 || hasMore) && (
				<div className="mt-4 flex items-center justify-between">
					<Button
						variant="outline"
						size="sm"
						disabled={page === 0}
						onClick={() => navigate(page - 1)}
					>
						Previous
					</Button>
					<span className="text-sm text-muted-foreground">
						Page {page + 1}
						{totalPages > 1 ? ` of ${totalPages}` : ""} · {total} transaction
						{total !== 1 ? "s" : ""}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={!hasMore}
						onClick={() => navigate(page + 1)}
					>
						Next
					</Button>
				</div>
			)}

			<AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<HugeiconsIcon icon={Alert01Icon} className="h-5 w-5 text-destructive" />
							Delete {selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Permanently deletes the selected transactions. Your account balances will be updated.
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={isPending}
							onClick={handleBulkDelete}
						>
							{isPending ? <Spinner /> : <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />}
							{isPending ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{editTarget && (
				<EditTransactionModal
					transaction={editTarget}
					workspaceId={workspaceId}
					open={!!editTarget}
					onOpenChange={(v) => {
						if (!v) setEditTarget(null);
					}}
				/>
			)}
		</section>
	);
}
