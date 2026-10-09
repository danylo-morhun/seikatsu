"use client";

import {
	archiveAccount,
	deleteAccount,
	toggleAccountDashboardVisibility,
} from "@/features/kuroji/actions/accounts";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import type { AccountBalance } from "@/features/kuroji/actions/balances";
import { AddAccountModal } from "@/features/kuroji/components/AddAccountModal";
import { EditAccountModal } from "@/features/kuroji/components/EditAccountModal";
import { displayBalance } from "@/features/kuroji/lib/balance";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { periodQuery } from "@/features/kuroji/lib/period";
import {
	Alert01Icon,
	Archive01Icon,
	ArrowDown01Icon,
	ArrowRight01Icon,
	Delete01Icon,
	EyeIcon,
	EyeOffIcon,
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
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";

const TYPE_ORDER = ["ASSET", "LIABILITY", "INCOME", "EXPENSE"] as const;

const TYPE_LABELS: Record<string, string> = {
	ASSET: "Assets",
	LIABILITY: "Liabilities",
	INCOME: "Income",
	EXPENSE: "Expenses",
};

type Account = Awaited<ReturnType<typeof getAccounts>>[number];

interface AccountRow extends AccountBalance {
	parentId: string | null;
}

interface Props {
	balances: AccountBalance[];
	currency: string;
	workspaceId: string;
	accounts: Account[];
	/** Range income and expense totals cover. */
	periodLabel: string;
	/** Point in time asset and liability balances are measured at. */
	asOfLabel?: string;
	hideHeader?: boolean;
	listMode?: boolean;
}

function AccountActions({
	acct,
	hidden,
	onEdit,
	onArchive,
	onDelete,
	onToggleHidden,
}: {
	acct: Account;
	hidden: boolean;
	onEdit: (a: Account) => void;
	onArchive: (id: string, name: string) => void;
	onDelete: (id: string, name: string) => void;
	onToggleHidden: (id: string, hidden: boolean) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-9 w-9 text-muted-foreground/50 hover:text-foreground"
				>
					<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => onEdit(acct)}>
					<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
					Edit
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onToggleHidden(acct.id, !hidden)}>
					<HugeiconsIcon icon={hidden ? EyeIcon : EyeOffIcon} className="mr-2 h-4 w-4" />
					{hidden ? "Show on dashboard" : "Hide from dashboard"}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onArchive(acct.id, acct.name)}>
					<HugeiconsIcon icon={Archive01Icon} className="mr-2 h-4 w-4" />
					Archive
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="text-red-500 focus:text-red-500"
					onClick={() => onDelete(acct.id, acct.name)}
				>
					<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function BalanceDisplay({
	row,
	acct,
	currency,
}: { row: AccountRow; acct: Account | undefined; currency: string }) {
	const acctCurrency = acct?.currency ?? currency;
	const isMulti = acctCurrency !== currency;
	const baseAmt = displayBalance(row.type, Number(row.balance));
	const nativeAmt = displayBalance(row.type, Number(row.nativeBalance));
	// Sign carries the meaning; red is only a second cue for an abnormal balance.
	const isNeg = baseAmt < 0;

	return (
		<span
			className={cn(
				"whitespace-nowrap text-right font-figures text-sm",
				isNeg ? "text-negative" : baseAmt === 0 ? "text-muted-foreground" : "text-foreground",
			)}
		>
			{isMulti ? (
				<>
					{formatCurrency(nativeAmt, acctCurrency)}
					<span className="block text-xs text-muted-foreground">
						≈ {formatCurrency(baseAmt, currency)}
					</span>
				</>
			) : (
				formatCurrency(baseAmt, currency)
			)}
		</span>
	);
}

export function AccountsOverview({
	balances,
	currency,
	workspaceId,
	accounts,
	periodLabel,
	asOfLabel,
	hideHeader = false,
	listMode = false,
}: Props) {
	const searchParams = useSearchParams();
	const detailQuery = periodQuery(searchParams);
	const [isPending, startTransition] = useTransition();
	const [editTarget, setEditTarget] = React.useState<Account | null>(null);
	const [confirmTarget, setConfirmTarget] = React.useState<{ id: string; name: string } | null>(
		null,
	);
	const [archiveTarget, setArchiveTarget] = React.useState<{ id: string; name: string } | null>(
		null,
	);
	const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
	const [showHidden, setShowHidden] = React.useState(false);

	const accountMap = new Map(accounts.map((a) => [a.id, a]));
	const accountIdSet = new Set(accounts.map((a) => a.id));

	const rows: AccountRow[] = balances
		.filter((b) => accountMap.has(b.accountId))
		.map((b) => ({
			...b,
			parentId: accountMap.get(b.accountId)?.parentId ?? null,
		}));

	const rowMap = new Map(rows.map((r) => [r.accountId, r]));

	const grouped = TYPE_ORDER.reduce<Record<string, AccountRow[]>>((acc, type) => {
		acc[type] = rows.filter((b) => b.type === type);
		return acc;
	}, {});

	function toggleExpand(id: string) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function handleDeleteConfirm() {
		if (!confirmTarget) return;
		const { id, name } = confirmTarget;
		startTransition(async () => {
			const result = await deleteAccount(id);
			if ("error" in result) {
				toast.error(result.error);
			} else {
				toast.success(`"${name}" deleted`);
			}
			setConfirmTarget(null);
		});
	}

	function handleArchiveConfirm() {
		if (!archiveTarget) return;
		const { id, name } = archiveTarget;
		startTransition(async () => {
			const result = await archiveAccount(id);
			if ("error" in result) {
				toast.error(result.error);
			} else {
				toast.success(`"${name}" archived`);
			}
			setArchiveTarget(null);
		});
	}

	function handleToggleHidden(id: string, hidden: boolean) {
		startTransition(async () => {
			const result = await toggleAccountDashboardVisibility(id, hidden);
			if ("error" in result) toast.error(result.error);
		});
	}

	function renderAccountRow(row: AccountRow, isChild = false) {
		const acct = accountMap.get(row.accountId);
		if (!acct) return null;

		const children =
			grouped[row.type]?.filter((r) => r.parentId === row.accountId && (!r.hidden || showHidden)) ??
			[];
		const hasChildren = children.length > 0;
		const isExpanded = expanded.has(row.accountId);

		const budget = acct.budget != null ? Number(acct.budget) : null;
		// Spent (expense) or earned (income) so far; a net refund counts as nothing used.
		const used = Math.max(displayBalance(row.type, Number(row.balance)), 0);
		const showBudget =
			(row.type === "EXPENSE" || row.type === "INCOME") && budget != null && budget > 0;
		const pct = showBudget ? Math.min((used / budget!) * 100, 100) : null;
		const overBudget = showBudget && used > budget!;
		const isIncome = row.type === "INCOME";

		return (
			<React.Fragment key={row.accountId}>
				<div className="flex flex-col">
					<div
						className={cn(
							"relative flex items-center gap-2 py-2.5 pr-1 pl-1 transition-colors hover:bg-surface",
							isChild && "pl-7",
						)}
					>
						{hasChildren ? (
							<button
								type="button"
								onClick={() => toggleExpand(row.accountId)}
								className="relative z-10 shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
								aria-label={isExpanded ? `Collapse ${row.name}` : `Expand ${row.name}`}
								aria-expanded={isExpanded}
							>
								<HugeiconsIcon
									icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
									className="h-3.5 w-3.5"
								/>
							</button>
						) : (
							<span className="w-3.5 shrink-0" />
						)}

						{/* Stretched link: the whole row navigates, the controls above it stay clickable. */}
						<Link
							href={`/kuroji/accounts/${row.accountId}${detailQuery}`}
							prefetch
							className={cn(
								"flex-1 min-w-0 truncate text-sm outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring",
								isChild ? "text-muted-foreground" : "font-medium",
							)}
						>
							{row.name}
						</Link>

						<div className="relative z-10 flex shrink-0 items-center gap-1">
							<BalanceDisplay row={row} acct={acct} currency={currency} />
							{!listMode && (
								<AccountActions
									acct={acct}
									hidden={row.hidden}
									onEdit={setEditTarget}
									onArchive={(id, name) => setArchiveTarget({ id, name })}
									onDelete={(id, name) => setConfirmTarget({ id, name })}
									onToggleHidden={handleToggleHidden}
								/>
							)}
						</div>
					</div>

					{showBudget && pct !== null && (
						// Budget as capacity: the bar fills its track; going over spills past the end.
						<div
							className={cn("flex items-center gap-3 pb-2.5", isChild ? "pl-7" : "pl-6.5", "pr-11")}
						>
							<span aria-hidden className="relative h-1 flex-1 rounded-full bg-surface-2">
								<span
									className={cn(
										"absolute inset-y-0 left-0 rounded-full",
										overBudget ? (isIncome ? "bg-positive" : "bg-negative") : "bg-primary/80",
									)}
									style={{ width: `${pct}%` }}
								/>
							</span>
							<span
								className={cn(
									"shrink-0 font-figures text-xs",
									overBudget && !isIncome ? "text-negative" : "text-muted-foreground",
								)}
							>
								{overBudget && !isIncome
									? `${formatCurrency(used - budget!, currency)} over ${formatCurrency(budget!, currency)}`
									: overBudget
										? `Target ${formatCurrency(budget!, currency)} reached`
										: `${formatCurrency(budget! - used, currency)} left of ${formatCurrency(budget!, currency)}`}
							</span>
						</div>
					)}
				</div>

				{isExpanded && children.map((child) => renderAccountRow(child, true))}
			</React.Fragment>
		);
	}

	const content = (
		<div className="space-y-8">
			{TYPE_ORDER.map((type) => {
				const group = grouped[type] ?? [];
				const parents = group.filter(
					(r) =>
						!r.parentId || !accountIdSet.has(r.parentId) || rowMap.get(r.parentId)?.type !== type,
				);
				if (parents.length === 0 && !listMode) return null;

				const typeAccounts = accounts.filter((a) => a.type === type);
				if (listMode && typeAccounts.length === 0) return null;

				const visibleParents = parents.filter(
					(r) => !r.hidden && (type === "ASSET" || r.name !== "Opening Balance"),
				);
				const hiddenParents = parents.filter(
					(r) => r.hidden && (type === "ASSET" || r.name !== "Opening Balance"),
				);
				// Nothing to show and nothing hidden: leave the group out instead of an empty box.
				if (!listMode && visibleParents.length === 0 && hiddenParents.length === 0) return null;
				// Flows read best busiest-first; balances keep their own order.
				if (!listMode && (type === "INCOME" || type === "EXPENSE")) {
					visibleParents.sort(
						(a, b) =>
							displayBalance(type, Number(b.balance)) - displayBalance(type, Number(a.balance)),
					);
				}
				const typeTotal = displayBalance(
					type,
					visibleParents.reduce((acc, b) => acc + Number(b.balance), 0),
				);

				return (
					<div key={type}>
						<div className="mb-1 flex items-baseline justify-between gap-3">
							<h3 className="text-sm">
								<span className="font-semibold">{TYPE_LABELS[type]}</span>
								{!listMode && (
									<span className="ml-2 text-xs text-muted-foreground">
										{type === "ASSET" || type === "LIABILITY" ? asOfLabel : periodLabel}
									</span>
								)}
							</h3>
							{!listMode && visibleParents.length > 0 && (
								<p
									data-total
									className={cn(
										"font-figures text-base font-semibold",
										typeTotal < 0 && "text-negative",
									)}
								>
									{formatCurrency(typeTotal, currency)}
								</p>
							)}
						</div>

						<div className="divide-y divide-rule border-y border-rule">
							{listMode ? (
								typeAccounts.map((acct) => {
									const row = rowMap.get(acct.id);
									return (
										<div key={acct.id} className="flex items-center justify-between py-2.5 pl-1">
											<span className="text-sm font-medium">{acct.name}</span>
											<div className="flex items-center gap-2">
												{row && <BalanceDisplay row={row} acct={acct} currency={currency} />}
												<AccountActions
													acct={acct}
													hidden={row?.hidden ?? false}
													onEdit={setEditTarget}
													onArchive={(id, name) => setArchiveTarget({ id, name })}
													onDelete={(id, name) => setConfirmTarget({ id, name })}
													onToggleHidden={handleToggleHidden}
												/>
											</div>
										</div>
									);
								})
							) : visibleParents.length === 0 && hiddenParents.length === 0 ? (
								<p className="px-3 py-3 text-xs text-muted-foreground">No accounts</p>
							) : (
								<>
									{visibleParents.map((row) => renderAccountRow(row, false))}
									{showHidden &&
										hiddenParents.map((row) => (
											<div key={row.accountId} className="opacity-40">
												{renderAccountRow(row, false)}
											</div>
										))}
									{hiddenParents.length > 0 && (
										<button
											type="button"
											onClick={() => setShowHidden((v) => !v)}
											className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
										>
											<HugeiconsIcon icon={showHidden ? EyeOffIcon : EyeIcon} className="h-3 w-3" />
											{showHidden ? "Hide" : `${hiddenParents.length} hidden`}
										</button>
									)}
								</>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);

	return (
		<section>
			{!hideHeader && (
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold">Accounts</h2>
					<AddAccountModal workspaceId={workspaceId} baseCurrency={currency} />
				</div>
			)}

			{content}

			{editTarget && (
				<EditAccountModal
					account={editTarget}
					workspaceId={workspaceId}
					open={!!editTarget}
					onOpenChange={(v) => {
						if (!v) setEditTarget(null);
					}}
				/>
			)}

			<AlertDialog
				open={!!archiveTarget}
				onOpenChange={(v) => {
					if (!v) setArchiveTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Archive "{archiveTarget?.name}"?</AlertDialogTitle>
						<AlertDialogDescription>
							The account will be hidden from pickers and the dashboard. Historical transactions are
							preserved. You can restore it from Settings.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction disabled={isPending} onClick={handleArchiveConfirm}>
							{isPending ? "Archiving…" : "Archive"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={!!confirmTarget}
				onOpenChange={(v) => {
					if (!v) setConfirmTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<HugeiconsIcon icon={Alert01Icon} className="h-5 w-5 text-destructive" />
							Delete "{confirmTarget?.name}"?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Only accounts without transactions can be deleted, and it can't be undone. To keep an
							account's history, archive it instead.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={isPending}
							onClick={handleDeleteConfirm}
						>
							<HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
							{isPending ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}
