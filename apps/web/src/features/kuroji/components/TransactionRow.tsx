"use client";

import type { RecentTransaction } from "@/features/kuroji/actions/transactions";
import { TransactionFlow } from "@/features/kuroji/components/TransactionFlow";
import { parseLocal } from "@/features/kuroji/lib/dates";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { categoryEnd } from "@/features/kuroji/lib/quick-categorize";
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
	DropdownMenuTrigger,
	cn,
} from "@seikatsu/ui";
import { format } from "date-fns";
import { memo, useRef } from "react";

const thisYear = new Date().getFullYear();

export function fmtDate(iso: string): string {
	const d = parseLocal(iso);
	return d.getFullYear() === thisYear ? format(d, "MMM d") : format(d, "MMM d, yyyy");
}

/** +1 money in, -1 money out, 0 a transfer between own accounts. */
export function flowOf(txn: RecentTransaction) {
	return txn.fromAccountType === "INCOME" ? 1 : txn.toAccountType === "EXPENSE" ? -1 : 0;
}

/** Same columns for rows and day headers; phones add the checkbox column in select mode. */
export function rowCols(selectMode: boolean) {
	return cn(
		"gap-x-3 md:grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,18rem)_8.5rem_2.25rem] md:gap-x-4",
		selectMode
			? "grid-cols-[1.25rem_minmax(0,1fr)_auto_2.25rem]"
			: "grid-cols-[minmax(0,1fr)_auto_2.25rem]",
	);
}

export type RowEvent =
	| { type: "edit" | "delete" | "toggle" }
	| { type: "account" | "tag"; id: string }
	| { type: "categorize"; anchor: HTMLElement };

interface Props {
	txn: RecentTransaction;
	currency: string;
	selected: boolean;
	/** Phones show checkboxes, and a tap selects instead of opening the row. */
	selectMode: boolean;
	/** Date order groups rows under day headers, so rows leave the date out. */
	byDay: boolean;
	accountFilterId?: string;
	/** One stable handler for every row, so a row re-renders only when its own data changes. */
	onEvent: (txn: RecentTransaction, event: RowEvent) => void;
}

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
		selectMode,
		byDay,
		accountFilterId,
		onEvent,
	}: Props) {
		const category = categoryEnd(txn);
		const menuTrigger = useRef<HTMLButtonElement>(null);
		// "Change category" waits for the menu to close, then opens the picker by the menu button.
		const pickerRequested = useRef(false);
		const flowProps = {
			fromId: txn.fromAccountId,
			fromName: txn.fromAccount,
			toId: txn.toAccountId,
			toName: txn.toAccount,
			activeId: accountFilterId,
			categoryEnd: category ? (category.kind === "EXPENSE" ? "to" : "from") : undefined,
			onCategorize: category
				? (anchor: HTMLElement) => onEvent(txn, { type: "categorize", anchor })
				: undefined,
		} as const;
		return (
			// The description button stretches over the row; controls inside sit above it.
			<li
				className={cn(
					"group/row relative grid items-center py-2.5",
					rowCols(selectMode),
					selected && "bg-surface",
				)}
			>
				<span className={cn("relative z-10 md:flex", selectMode ? "flex" : "hidden")}>
					<Checkbox
						checked={selected}
						onCheckedChange={() => onEvent(txn, { type: "toggle" })}
						aria-label={`Select ${txn.description ?? "transaction"}`}
					/>
				</span>
				<div className="min-w-0">
					<button
						type="button"
						onClick={() => onEvent(txn, { type: selectMode ? "toggle" : "edit" })}
						className="block w-full min-w-0 rounded text-left outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span className="block truncate text-sm font-medium">
							{txn.description ?? "No description"}
						</span>
						{!byDay && (
							<span className="mt-0.5 hidden text-xs text-muted-foreground md:block">
								{fmtDate(txn.date)}
							</span>
						)}
					</button>
					<span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground md:hidden">
						{!byDay && <span className="shrink-0">{fmtDate(txn.date)}</span>}
						<TransactionFlow className="text-xs" {...flowProps} />
					</span>
				</div>
				<span className="hidden min-w-0 md:block">
					<TransactionFlow
						{...flowProps}
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
									className="relative z-10 rounded-full border border-rule px-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
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
							ref={menuTrigger}
							variant="ghost"
							size="icon"
							className="relative z-10 h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
						>
							<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
							<span className="sr-only">Actions for {txn.description ?? "transaction"}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						onCloseAutoFocus={(e) => {
							if (!pickerRequested.current || !menuTrigger.current) return;
							pickerRequested.current = false;
							e.preventDefault();
							onEvent(txn, { type: "categorize", anchor: menuTrigger.current });
						}}
					>
						<DropdownMenuItem onSelect={() => onEvent(txn, { type: "edit" })}>
							<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
							Edit
						</DropdownMenuItem>
						{category && (
							<DropdownMenuItem
								onSelect={() => {
									pickerRequested.current = true;
								}}
							>
								<HugeiconsIcon icon={Folder01Icon} className="mr-2 h-4 w-4" />
								Change category
							</DropdownMenuItem>
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
		prev.selectMode === next.selectMode &&
		prev.byDay === next.byDay &&
		prev.accountFilterId === next.accountFilterId &&
		prev.onEvent === next.onEvent,
);
