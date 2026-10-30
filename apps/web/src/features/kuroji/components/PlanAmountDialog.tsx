"use client";

import { Spinner } from "@/components/Spinner";
import { setCategoryPlan } from "@/features/kuroji/actions/plan";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { parseAmount } from "@/features/kuroji/lib/transaction-schema";
import { NEEDS_CONNECTION, offlineError } from "@/features/pwa/lib/run";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	cn,
} from "@seikatsu/ui";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

export type PlanTarget = {
	accountId: string;
	name: string;
	type: "EXPENSE" | "INCOME";
	plan: number;
	overridden: boolean;
	defaultPlan: number;
};

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The category being edited; null = pick one from `choices`. */
	target: PlanTarget | null;
	/** Categories without a plan, for "Plan a category". */
	choices: { id: string; name: string; type: "EXPENSE" | "INCOME" }[];
	/** Prefill when planning a category that has spending but no plan. */
	suggested?: number;
	month: string;
	monthLabel: string;
	currency: string;
}

type Scope = "month" | "default";

/**
 * Plan one category: an amount, and whether it's this month's own or the default from this
 * month on. The same dialog edits, overrides and removes.
 */
export function PlanAmountDialog({
	open,
	onOpenChange,
	target,
	choices,
	suggested,
	month,
	monthLabel,
	currency,
}: Props) {
	const [accountId, setAccountId] = useState("");
	const [amount, setAmount] = useState("");
	const [scope, setScope] = useState<Scope>("default");
	const [pending, startTransition] = useTransition();

	useEffect(() => {
		if (!open) return;
		setAccountId(target?.accountId ?? "");
		const start = target?.plan || suggested;
		setAmount(start ? String(Math.round(start)) : "");
		setScope(target?.overridden ? "month" : "default");
	}, [open, target, suggested]);

	const chosen = target ?? choices.find((c) => c.id === accountId);
	const isIncome = chosen?.type === "INCOME";

	function save(value: number | null, as: Scope) {
		if (!chosen) return;
		const id = target?.accountId ?? accountId;
		startTransition(async () => {
			const result =
				offlineError() ??
				(await setCategoryPlan({ accountId: id, month, amount: value, scope: as }).catch(() => ({
					error: NEEDS_CONNECTION,
				})));
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			onOpenChange(false);
		});
	}

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const value = parseAmount(amount);
		if (value == null || value <= 0) {
			toast.error("Enter an amount");
			return;
		}
		save(value, scope);
	}

	const hasPlan = (target?.plan ?? 0) > 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{target ? target.name : "Plan a category"}</DialogTitle>
					<DialogDescription>
						{isIncome ? "Income you expect in " : "What you mean to spend in "}
						{monthLabel}.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={onSubmit} className="space-y-4">
					{!target && (
						<div className="space-y-2">
							<Label htmlFor="plan-category">Category</Label>
							<Select value={accountId} onValueChange={setAccountId}>
								<SelectTrigger id="plan-category">
									<SelectValue placeholder="Choose a category" />
								</SelectTrigger>
								<SelectContent>
									{choices.map((c) => (
										<SelectItem key={c.id} value={c.id}>
											{c.name}
											{c.type === "INCOME" && (
												<span className="text-muted-foreground"> · income</span>
											)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="plan-amount">{isIncome ? "Expected" : "Plan"}</Label>
						<Input
							id="plan-amount"
							type="text"
							inputMode="decimal"
							autoComplete="off"
							autoFocus={!!target}
							placeholder={formatCurrency(0, currency)}
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
						/>
					</div>

					<fieldset className="space-y-2">
						<legend className="text-sm font-medium">Applies to</legend>
						<div className="grid grid-cols-2 gap-1 rounded-md bg-surface p-0.5">
							{(
								[
									["month", `${monthLabel} only`],
									["default", `From ${monthLabel} on`],
								] as const
							).map(([value, label]) => (
								<button
									key={value}
									type="button"
									aria-pressed={scope === value}
									onClick={() => setScope(value)}
									className={cn(
										"truncate rounded px-2 py-1.5 text-xs font-medium transition-colors",
										scope === value
											? "bg-surface-2 text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{label}
								</button>
							))}
						</div>
					</fieldset>

					<div className="flex items-center justify-between gap-2 pt-2">
						{target?.overridden ? (
							<Button
								type="button"
								variant="ghost"
								disabled={pending}
								onClick={() => save(null, "month")}
							>
								{target.defaultPlan > 0
									? `Back to ${formatCurrency(target.defaultPlan, currency)}`
									: "Remove for this month"}
							</Button>
						) : hasPlan ? (
							<Button
								type="button"
								variant="ghost"
								className="text-destructive hover:text-destructive"
								disabled={pending}
								onClick={() => save(null, "default")}
							>
								Remove plan
							</Button>
						) : (
							<span />
						)}
						<Button type="submit" disabled={pending || !chosen} className="gap-1.5">
							{pending && <Spinner />}
							{pending ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
