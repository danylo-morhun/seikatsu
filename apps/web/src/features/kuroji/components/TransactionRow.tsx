"use client";

import type { RecentTransaction } from "@/features/kuroji/actions/transactions";
import { TransactionFlow } from "@/features/kuroji/components/TransactionFlow";
import { parseLocal } from "@/features/kuroji/lib/dates";
import { formatCurrency } from "@/features/kuroji/lib/format";
import {
	Delete01Icon,
	Folder01Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Checkbox,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	cn,
} from "@seikatsu/ui";
import { format } from "date-fns";
import { memo } from "react";

const thisYear = new Date().getFullYear();

export function fmtDate(iso: string): string {
	const d = parseLocal(iso);
	return d.getFullYear() === thisYear ? format(d, "MMM d") : format(d, "MMM d, yyyy");
}

/** +1 money in, -1 money out, 0 a transfer between own accounts. */
export function flowOf(txn: RecentTransaction) {
	return txn.fromAccountType === "INCOME" ? 1 : txn.toAccountType === "EXPENSE" ? -1 : 0;
}

/** Same columns for rows, day headers and the column header. */
export const ROW_COLS =
	"grid-cols-[minmax(0,1fr)_auto_2.25rem] gap-x-3 md:grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,18rem)_8.5rem_2.25rem] md:gap-x-4";

export type RowEvent =
	| { type: "edit" | "delete" | "toggle" }
	| { type: "account" | "tag"; id: string }
	| { type: "move"; categoryId: string };

type Category = { id: string; name: string };

interface Props {
	txn: RecentTransaction;
	currency: string;
	selected: boolean;
	/** Date order groups rows under day headers, so rows leave the date out. */
	byDay: boolean;
	accountFilterId?: string;
	expenseCategories: Category[];
	incomeCategories: Category[];
	/** One stable handler for every row, so a row re-renders only when its own data changes. */
	onEvent: (txn: RecentTransaction, event: RowEvent) => void;
}

const categoryKind = (txn: RecentTransaction) =>
	txn.splitCount > 1
		? null
		: txn.toAccountType === "EXPENSE"
			? "EXPENSE"
			: txn.fromAccountType === "INCOME"
				? "INCOME"
				: null;

// Money in reads "+", money out "−"; transfers between own accounts carry no sign.
function Amount({ txn, currency }: { txn: RecentTransaction; currency: string }) {
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

// Field-wise: every refresh maps fresh row objects, mostly with the same content.
const legsKey = (t: RecentTransaction) =>
	t.legs.map((l) => `${l.accountId}:${l.amount}:${l.currency}:${l.baseAmount}`).join();
const tagsKey = (t: RecentTransaction) => t.tags.map((g) => `${g.id}:${g.name}`).join();

function sameTxn(a: RecentTransaction, b: RecentTransaction) {
	return (
		a.id === b.id &&
		a.date === b.date &&
		a.description === b.description &&
		a.fromAccountId === b.fromAccountId &&
		a.fromAccount === b.fromAccount &&
		a.toAccountId === b.toAccountId &&
		a.toAccount === b.toAccount &&
		a.amount === b.amount &&
		a.baseAmount === b.baseAmount &&
		a.currency === b.currency &&
		a.splitCount === b.splitCount &&
		a.imported === b.imported &&
		legsKey(a) === legsKey(b) &&
		tagsKey(a) === tagsKey(b)
	);
}

export const TransactionRow = memo(
	function TransactionRow({
		txn,
		currency,
		selected,
		byDay,
		accountFilterId,
		expenseCategories,
		incomeCategories,
		onEvent,
	}: Props) {
		const kind = categoryKind(txn);
		const current = kind === "EXPENSE" ? txn.toAccountId : txn.fromAccountId;
		const moveTargets = kind === "EXPENSE" ? expenseCategories : incomeCategories;
		return (
			<li
				className={cn(
					"group/row grid items-center py-2.5",
					ROW_COLS,
					selected && "bg-primary/[0.06]",
				)}
			>
				<span className="hidden md:flex">
					<Checkbox
						checked={selected}
						onCheckedChange={() => onEvent(txn, { type: "toggle" })}
						aria-label={`Select ${txn.description ?? "transaction"}`}
					/>
				</span>
				<button
					type="button"
					onClick={() => onEvent(txn, { type: "edit" })}
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
						onSelect={(id) => onEvent(txn, { type: "account", id })}
					/>
					{txn.tags.length > 0 && (
						<span className="mt-1 flex flex-wrap gap-1">
							{txn.tags.map((tag) => (
								<button
									key={tag.id}
									type="button"
									title={`Show only tag ${tag.name}`}
									onClick={() => onEvent(txn, { type: "tag", id: tag.id })}
									className="rounded-full border border-rule px-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
								>
									{tag.name}
								</button>
							))}
						</span>
					)}
				</span>
				<Amount txn={txn} currency={currency} />
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
						<DropdownMenuItem onSelect={() => onEvent(txn, { type: "edit" })}>
							<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
							Edit
						</DropdownMenuItem>
						{kind && (
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<HugeiconsIcon icon={Folder01Icon} className="mr-2 h-4 w-4" />
									Move to
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent className="max-h-80 overflow-y-auto">
									{moveTargets.map((c) => (
										<DropdownMenuItem
											key={c.id}
											disabled={c.id === current}
											onSelect={() => onEvent(txn, { type: "move", categoryId: c.id })}
										>
											{c.name}
										</DropdownMenuItem>
									))}
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onSelect={() => onEvent(txn, { type: "delete" })}
						>
							<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</li>
		);
	},
	(prev, next) =>
		sameTxn(prev.txn, next.txn) &&
		prev.currency === next.currency &&
		prev.selected === next.selected &&
		prev.byDay === next.byDay &&
		prev.accountFilterId === next.accountFilterId &&
		prev.expenseCategories === next.expenseCategories &&
		prev.incomeCategories === next.incomeCategories &&
		prev.onEvent === next.onEvent,
);
