"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { Spinner } from "@/components/Spinner";
import { exportTransactionsCsv } from "@/features/kuroji/actions/export";
import { deleteTransaction, deleteTransactions } from "@/features/kuroji/actions/transactions";
import type { RecentTransaction } from "@/features/kuroji/actions/transactions";
import { EditTransactionModal } from "@/features/kuroji/components/EditTransactionModal";
import { PeriodEmptyActions } from "@/features/kuroji/components/PeriodEmptyActions";
import { TransactionFlow } from "@/features/kuroji/components/TransactionFlow";
import { buildPeriodLabel, parseLocal } from "@/features/kuroji/lib/dates";
import { formatCurrency } from "@/features/kuroji/lib/format";
import {
	Alert01Icon,
	Cancel01Icon,
	Delete01Icon,
	Download01Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
	Search01Icon,
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
	cn,
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

function fmtDay(iso: string): string {
	const d = parseLocal(iso);
	return d.getFullYear() === thisYear ? format(d, "EEE, MMM d") : format(d, "EEE, MMM d, yyyy");
}

/** +1 money in, -1 money out, 0 a transfer between own accounts. */
function flowOf(txn: RecentTransaction) {
	return txn.fromAccountType === "INCOME" ? 1 : txn.toAccountType === "EXPENSE" ? -1 : 0;
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
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [editTarget, setEditTarget] = useState<RecentTransaction | null>(null);
	const [localQuery, setLocalQuery] = useState(searchQuery ?? "");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

	// A new page, search or filter is a new list: never carry a selection you can't see.
	const [selectionFor, setSelectionFor] = useState(transactions);
	if (selectionFor !== transactions) {
		setSelectionFor(transactions);
		setSelectedIds(new Set());
	}

	function navigate(newPage: number) {
		const params = new URLSearchParams(searchParams.toString());
		if (newPage === 0) params.delete("page");
		else params.set("page", String(newPage));
		startNavigationProgress();
		router.push(`${pathname}?${params.toString()}`);
	}

	function filterByAccount(id: string) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("account", id);
		params.delete("page");
		startNavigationProgress();
		router.push(`${pathname}?${params.toString()}`);
	}

	function clearAccountFilter() {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("account");
		params.delete("page");
		startNavigationProgress();
		router.push(`${pathname}?${params.toString()}`);
	}

	function filterByTag(id: string) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("tag", id);
		params.delete("page");
		startNavigationProgress();
		router.push(`${pathname}?${params.toString()}`);
	}

	function clearTagFilter() {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("tag");
		params.delete("page");
		startNavigationProgress();
		router.push(`${pathname}?${params.toString()}`);
	}

	function submitSearch(value: string) {
		const params = new URLSearchParams(searchParams.toString());
		if (value.trim()) params.set("q", value.trim());
		else params.delete("q");
		params.delete("page");
		startNavigationProgress();
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
		startNavigationProgress();
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
			}
			setBulkDeleteOpen(false);
		});
	}

	const totalPages = Math.ceil(total / 10);

	// Say why the list is empty: a search, a filter or a quiet period is not an empty ledger.
	const periodLabel = dateFrom && dateTo ? buildPeriodLabel(dateFrom, dateTo) : null;
	const isFirstUse = !searchQuery && !periodLabel && !accountFilterId && !tagFilterId;
	const emptyMessage = searchQuery
		? periodLabel
			? `No transactions match "${searchQuery}" in ${periodLabel}`
			: `No transactions match "${searchQuery}"`
		: periodLabel
			? `No transactions in ${periodLabel}`
			: isFirstUse
				? "No transactions yet"
				: accountFilterId && !tagFilterId
					? `No transactions in ${accountFilterName ?? "this account"} yet`
					: "No transactions match these filters";

	// Money in reads "+", money out "−"; transfers between own accounts carry no sign.
	function renderAmount(txn: RecentTransaction) {
		const flow = flowOf(txn);
		const signed = (value: string, cur: string) => {
			const n = Math.abs(Number(value));
			const text = formatCurrency(flow < 0 ? -n : n, cur);
			return flow > 0 ? `+${text}` : text;
		};
		const isForeign = txn.currency && txn.currency !== currency;
		return (
			<span className="block text-right">
				<span
					className={cn(
						"block font-figures text-sm font-medium",
						flow > 0 && "text-positive",
						flow === 0 && "text-muted-foreground",
					)}
				>
					{isForeign ? signed(txn.amount, txn.currency) : signed(txn.baseAmount, currency)}
				</span>
				{isForeign && (
					<span className="block text-xs text-muted-foreground">
						≈ {signed(txn.baseAmount, currency)}
					</span>
				)}
			</span>
		);
	}

	function renderActions(txn: RecentTransaction) {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
					>
						<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
						<span className="sr-only">Actions for {txn.description ?? "transaction"}</span>
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
		);
	}

	const emptyState = (
		<div className="px-4 py-12 text-center">
			<p className="text-sm font-medium">{emptyMessage}</p>
			{isFirstUse ? (
				<p className="mt-1 text-sm text-muted-foreground">
					Use New Transaction to record your first one.
				</p>
			) : (
				<div className="mt-4">
					<PeriodEmptyActions from={dateFrom} to={dateTo} />
				</div>
			)}
		</div>
	);

	// Grouped by day when the list is in date order; the header names each day and its net.
	const byDay = sortField === "date";
	const groups: { key: string; label: string; rows: RecentTransaction[] }[] = [];
	for (const txn of transactions) {
		const key = byDay ? txn.date : "all";
		const last = groups[groups.length - 1];
		if (last?.key === key) last.rows.push(txn);
		else groups.push({ key, label: byDay ? fmtDay(txn.date) : "", rows: [txn] });
	}
	// Like a dictionary's guide words: the span of dates on this page.
	const dates = transactions.map((t) => t.date).sort();
	const span =
		dates.length === 0
			? null
			: dates[0] === dates[dates.length - 1]
				? fmtDate(dates[0])
				: `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;

	const sortButton = (field: "date" | "amount", label: string) => (
		<button
			type="button"
			onClick={() => sortBy(field)}
			aria-label={`Sort by ${label.toLowerCase()}`}
			className={cn(
				"inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground",
				sortField === field && "text-foreground",
			)}
		>
			{label}
			<span aria-hidden className="text-muted-foreground/70">
				{sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
			</span>
		</button>
	);

	const renderRow = (txn: RecentTransaction) => {
		const selected = selectedIds.has(txn.id);
		return (
			<li
				key={txn.id}
				className={cn(
					"group/row grid grid-cols-[minmax(0,1fr)_auto_2.25rem] items-center gap-x-3 py-2.5 md:grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,18rem)_8.5rem_2.25rem] md:gap-x-4",
					selected && "bg-primary/[0.06]",
				)}
			>
				<span className="hidden md:flex">
					<Checkbox
						checked={selected}
						onCheckedChange={() => toggleSelect(txn.id)}
						aria-label={`Select ${txn.description ?? "transaction"}`}
					/>
				</span>
				<button
					type="button"
					onClick={() => setEditTarget(txn)}
					className="min-w-0 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<span className="block truncate text-sm font-medium">
						{txn.description ?? "No description"}
					</span>
					<span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground md:hidden">
						{!byDay && <span className="shrink-0">{fmtDate(txn.date)}</span>}
						<TransactionFlow
							className="text-xs"
							fromId={txn.fromAccountId}
							fromName={txn.fromAccount}
							toId={txn.toAccountId}
							toName={txn.toAccount}
							activeId={accountFilterId}
						/>
					</span>
					{!byDay && (
						<span className="mt-0.5 hidden text-xs text-muted-foreground md:block">
							{fmtDate(txn.date)}
						</span>
					)}
				</button>
				<span className="hidden min-w-0 md:block">
					<TransactionFlow
						fromId={txn.fromAccountId}
						fromName={txn.fromAccount}
						toId={txn.toAccountId}
						toName={txn.toAccount}
						activeId={accountFilterId}
						onSelect={filterByAccount}
					/>
					{txn.tags.length > 0 && (
						<span className="mt-1 flex flex-wrap gap-1">
							{txn.tags.map((tag) => (
								<button
									key={tag.id}
									type="button"
									title={`Show only tag ${tag.name}`}
									onClick={() => filterByTag(tag.id)}
									className="rounded-full border border-rule px-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
								>
									{tag.name}
								</button>
							))}
						</span>
					)}
				</span>
				{renderAmount(txn)}
				{renderActions(txn)}
			</li>
		);
	};

	return (
		<section>
			<div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div className="min-w-0">
					<h2 className="text-lg font-semibold">Transactions</h2>
					<p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
						<span>
							{total} {total === 1 ? "transaction" : "transactions"}
							{span && ` · ${span}`}
						</span>
						{accountFilterId && accountFilterName && (
							<span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-foreground">
								{accountFilterName}
								<button
									type="button"
									aria-label={`Remove filter ${accountFilterName}`}
									className="text-muted-foreground hover:text-foreground"
									onClick={clearAccountFilter}
								>
									<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
								</button>
							</span>
						)}
						{tagFilterId && tagFilterName && (
							<span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-foreground">
								<HugeiconsIcon icon={Tag01Icon} className="h-3 w-3" />
								{tagFilterName}
								<button
									type="button"
									aria-label={`Remove filter ${tagFilterName}`}
									className="text-muted-foreground hover:text-foreground"
									onClick={clearTagFilter}
								>
									<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
								</button>
							</span>
						)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					{selectedIds.size > 0 && (
						<Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
							Delete {selectedIds.size}
						</Button>
					)}
					<form
						role="search"
						className="relative flex-1 md:w-64 md:flex-none"
						onSubmit={(e) => {
							e.preventDefault();
							submitSearch(localQuery);
						}}
					>
						<HugeiconsIcon
							icon={Search01Icon}
							className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							type="search"
							aria-label="Search transactions"
							placeholder="Search, then Enter"
							className="pl-9"
							value={localQuery}
							onChange={(e) => {
								setLocalQuery(e.target.value);
								// Clearing the box clears the search.
								if (e.target.value === "" && searchQuery) submitSearch("");
							}}
						/>
					</form>
					<Button
						variant="outline"
						size="icon"
						onClick={handleExport}
						disabled={isExporting}
						aria-label="Export CSV"
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

			{/* Column header: select-all and sorting. Desktop only; phones sort by date. */}
			<div className="hidden grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,18rem)_8.5rem_2.25rem] items-center gap-x-4 border-b border-rule py-2 text-xs text-muted-foreground md:grid">
				<Checkbox
					checked={transactions.length > 0 && selectedIds.size === transactions.length}
					onCheckedChange={toggleSelectAll}
					aria-label="Select all on this page"
				/>
				<span>{sortButton("date", "Date")}</span>
				<span>From → To</span>
				<span className="text-right">{sortButton("amount", "Amount")}</span>
				<span />
			</div>

			{transactions.length === 0 ? (
				emptyState
			) : (
				<div>
					{groups.map((g) => {
						const dayNet = g.rows.reduce(
							(sum, t) => sum + flowOf(t) * Math.abs(Number(t.baseAmount)),
							0,
						);
						return (
							<section key={g.key} aria-label={g.label || undefined}>
								{byDay && (
									<header className="flex items-baseline justify-between border-b border-rule pt-4 pb-1.5 text-xs text-muted-foreground">
										<span className="font-medium text-foreground/80">{g.label}</span>
										{dayNet !== 0 && (
											<span className={cn("font-figures", dayNet > 0 && "text-positive")}>
												{dayNet > 0 ? "+" : ""}
												{formatCurrency(dayNet, currency)}
											</span>
										)}
									</header>
								)}
								<ul className="divide-y divide-rule">{g.rows.map(renderRow)}</ul>
							</section>
						);
					})}
				</div>
			)}
			{(page > 0 || hasMore) && (
				<div className="mt-4 flex items-center justify-between border-t border-rule pt-4">
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
						{totalPages > 1 ? ` of ${totalPages}` : ""}
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

			<AlertDialog open={pendingId !== null} onOpenChange={(open) => !open && setPendingId(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<HugeiconsIcon icon={Alert01Icon} className="h-5 w-5 text-destructive" />
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
							onClick={() => pendingId && handleDelete(pendingId)}
						>
							{isPending ? <Spinner /> : <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />}
							{isPending ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

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
