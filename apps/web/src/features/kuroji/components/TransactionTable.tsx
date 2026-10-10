"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { Spinner } from "@/components/Spinner";
import { createBankRule } from "@/features/kuroji/actions/bank";
import { exportTransactionsCsv } from "@/features/kuroji/actions/export";
import {
	deleteTransaction,
	deleteTransactions,
	recategorizeTransactions,
} from "@/features/kuroji/actions/transactions";
import type { RecentTransaction } from "@/features/kuroji/actions/transactions";
import { CategoryPicker } from "@/features/kuroji/components/CategoryPicker";
import { EditTransactionModal } from "@/features/kuroji/components/EditTransactionModal";
import { PeriodEmptyActions } from "@/features/kuroji/components/PeriodEmptyActions";
import {
	ROW_COLS,
	type RowEvent,
	TransactionRow,
	flowOf,
	fmtDate,
} from "@/features/kuroji/components/TransactionRow";
import { buildPeriodLabel, parseLocal } from "@/features/kuroji/lib/dates";
import { useFormOptions } from "@/features/kuroji/lib/form-options-store";
import { formatCurrency } from "@/features/kuroji/lib/format";
import {
	categoryEnd,
	pickableCategories,
	recentCategoryIds,
	withCategory,
} from "@/features/kuroji/lib/quick-categorize";
import { ruleKeyword } from "@/features/kuroji/lib/rule-keyword";
import {
	TRANSACTIONS_PAGE_SIZE,
	type TransactionFilters,
} from "@/features/kuroji/lib/transaction-filters";
import {
	Alert01Icon,
	Cancel01Icon,
	Delete01Icon,
	Download01Icon,
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
	DropdownMenuLabel,
	DropdownMenuTrigger,
	Input,
	cn,
} from "@seikatsu/ui";
import { format } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useOptimistic,
	useRef,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";

const thisYear = new Date().getFullYear();

function fmtDay(iso: string): string {
	const d = parseLocal(iso);
	return d.getFullYear() === thisYear ? format(d, "EEE, MMM d") : format(d, "EEE, MMM d, yyyy");
}

interface Props {
	transactions: RecentTransaction[];
	currency: string;
	workspaceId: string;
	page: number;
	hasMore: boolean;
	total: number;
	/** The filters the list was queried with; the export uses the same. */
	filters: TransactionFilters;
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
	filters,
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
	const [, startCategorize] = useTransition();
	const [picker, setPicker] = useState<{ txnId: string; anchor: HTMLElement } | null>(null);
	// A categorised row reads as filed at once; the server's answer replaces it.
	const [shown, fileOptimistic] = useOptimistic(
		transactions,
		(rows, filed: { id: string; category: { id: string; name: string } }) =>
			rows.map((t) => (t.id === filed.id ? withCategory(t, filed.category) : t)),
	);
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
		const result = await exportTransactionsCsv(workspaceId, filters);
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

	const totalPages = Math.ceil(total / TRANSACTIONS_PAGE_SIZE);

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

	// Categories a transaction can be moved to: postable income/expense accounts.
	const { accounts: formAccounts } = useFormOptions(
		workspaceId,
		selectedIds.size > 0 || picker !== null,
	);
	const { expenseCategories, incomeCategories } = useMemo(() => {
		const parentIds = new Set(formAccounts.map((a) => a.parentId).filter(Boolean));
		const leaves = (type: "EXPENSE" | "INCOME") =>
			formAccounts
				.filter((a) => a.type === type && !parentIds.has(a.id))
				.sort((a, b) => a.name.localeCompare(b.name));
		return { expenseCategories: leaves("EXPENSE"), incomeCategories: leaves("INCOME") };
	}, [formAccounts]);
	const categoriesOf = (type: "EXPENSE" | "INCOME") =>
		type === "EXPENSE" ? expenseCategories : incomeCategories;

	function moveTo(ids: string[], categoryId: string) {
		startTransition(async () => {
			const result = await recategorizeTransactions(workspaceId, ids, categoryId);
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			const { moved, skipped } = result.data;
			if (skipped > 0) {
				toast(`Moved ${moved}. ${skipped} skipped: split, transfer or another currency.`);
			} else if (ids.length > 1) {
				toast.success(`Moved ${moved} transactions.`);
			}
			setSelectedIds(new Set());
		});
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
	for (const txn of shown) {
		const key = byDay ? txn.date : "all";
		const last = groups[groups.length - 1];
		if (last?.key === key) last.rows.push(txn);
		else groups.push({ key, label: byDay ? fmtDay(txn.date) : "", rows: [txn] });
	}
	// Like a dictionary's guide words: the span of dates on this page.
	const dates = shown.map((t) => t.date).sort();
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

	function categorize(txn: RecentTransaction, category: { id: string; name: string }) {
		startCategorize(async () => {
			fileOptimistic({ id: txn.id, category });
			const result = await recategorizeTransactions(workspaceId, [txn.id], category.id);
			if ("error" in result) toast.error(result.error);
			else if (result.data.moved === 0) toast.error("This transaction can't be moved there.");
			else offerRule(txn, category);
		});
	}

	// After filing a bank import, offer to file its merchant there from now on. Never automatic.
	function offerRule(txn: RecentTransaction, category: { id: string; name: string }) {
		const keyword = txn.imported ? ruleKeyword(txn.description) : null;
		if (!keyword) return;
		toast(`Filed under ${category.name}`, {
			action: {
				label: `Always file "${keyword}" here`,
				onClick: async () => {
					const result = await createBankRule(workspaceId, keyword, category.id);
					if ("error" in result) toast.error(result.error);
					else toast.success(`New imports with "${keyword}" go to ${category.name}.`);
				},
			},
		});
	}

	const pickerTxn = picker ? shown.find((t) => t.id === picker.txnId) : undefined;
	const pickerEnd = pickerTxn ? categoryEnd(pickerTxn) : null;

	// Rows get one stable handler; it always acts on the newest copy of the row.
	const handleRowEvent = (row: RecentTransaction, event: RowEvent) => {
		const txn = transactions.find((t) => t.id === row.id) ?? row;
		if (event.type === "edit") setEditTarget(txn);
		else if (event.type === "delete") setPendingId(txn.id);
		else if (event.type === "toggle") toggleSelect(txn.id);
		else if (event.type === "account") filterByAccount(event.id);
		else if (event.type === "tag") filterByTag(event.id);
		else if (event.type === "categorize") setPicker({ txnId: txn.id, anchor: event.anchor });
	};
	const latestRowEvent = useRef(handleRowEvent);
	useLayoutEffect(() => {
		latestRowEvent.current = handleRowEvent;
	});
	const onRowEvent = useCallback(
		(row: RecentTransaction, event: RowEvent) => latestRowEvent.current(row, event),
		[],
	);

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
						<>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" disabled={isPending}>
										Move {selectedIds.size} to…
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="max-h-96 w-56 overflow-y-auto">
									{(["EXPENSE", "INCOME"] as const).map((type) => (
										<div key={type}>
											<DropdownMenuLabel className="text-xs text-muted-foreground">
												{type === "EXPENSE" ? "Expenses" : "Income"}
											</DropdownMenuLabel>
											{categoriesOf(type).map((c) => (
												<DropdownMenuItem
													key={c.id}
													onSelect={() => moveTo([...selectedIds], c.id)}
												>
													{c.name}
												</DropdownMenuItem>
											))}
										</div>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
							<Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
								Delete {selectedIds.size}
							</Button>
						</>
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
				<span className="flex items-center gap-2">
					From
					<span aria-hidden className="flow-line relative h-px w-6 shrink-0 bg-flow" />
					<span className="sr-only">to</span>
					<span aria-hidden>To</span>
				</span>
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
									// Same columns as the rows, so the day's net sits in the amount column.
									<header
										className={cn(
											"grid items-baseline border-b border-rule pt-4 pb-1.5 text-xs text-muted-foreground",
											ROW_COLS,
										)}
									>
										<span className="font-medium text-foreground/80 md:col-span-3">{g.label}</span>
										<span className={cn("text-right font-figures", dayNet > 0 && "text-positive")}>
											{dayNet !== 0 && (
												<>
													{dayNet > 0 ? "+" : ""}
													{formatCurrency(dayNet, currency)}
												</>
											)}
										</span>
									</header>
								)}
								<ul className="divide-y divide-rule">
									{g.rows.map((txn) => (
										<TransactionRow
											key={txn.id}
											txn={txn}
											currency={currency}
											selected={selectedIds.has(txn.id)}
											byDay={byDay}
											accountFilterId={accountFilterId}
											onEvent={onRowEvent}
										/>
									))}
								</ul>
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

			{pickerTxn && pickerEnd && (
				<CategoryPicker
					anchor={picker?.anchor ?? null}
					onClose={() => setPicker(null)}
					categoriesFor={(query) =>
						pickableCategories(formAccounts, {
							kind: pickerEnd.kind,
							currency: pickerEnd.currency,
							recentIds: recentCategoryIds(shown, pickerEnd.kind),
							query,
						})
					}
					currentId={pickerEnd.categoryId}
					currentName={pickerEnd.kind === "EXPENSE" ? pickerTxn.toAccount : pickerTxn.fromAccount}
					onPick={(category) => {
						setPicker(null);
						if (category.id !== pickerEnd.categoryId) categorize(pickerTxn, category);
					}}
					onShowOnly={() => {
						setPicker(null);
						filterByAccount(pickerEnd.categoryId);
					}}
				/>
			)}

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
