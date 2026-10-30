"use client";

import { Spinner } from "@/components/Spinner";
import { adoptPlanDefaults } from "@/features/kuroji/actions/plan";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { parseAmount } from "@/features/kuroji/lib/transaction-schema";
import { NEEDS_CONNECTION, offlineError } from "@/features/pwa/lib/run";
import { Button, Checkbox, Input } from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	workspaceId: string;
	currency: string;
	suggestions: { accountId: string; name: string; average: number }[];
}

/** A first plan from what the last three months actually cost, rounded to tens. */
export function PlanSuggestions({ workspaceId, currency, suggestions }: Props) {
	const [rows, setRows] = useState(() =>
		suggestions.map((s) => ({
			...s,
			use: true,
			amount: String(Math.max(10, Math.ceil(s.average / 10) * 10)),
		})),
	);
	const [pending, startTransition] = useTransition();

	const chosen = rows
		.filter((r) => r.use)
		.map((r) => ({ accountId: r.accountId, amount: parseAmount(r.amount) ?? 0 }))
		.filter((r) => r.amount > 0);
	const total = chosen.reduce((s, r) => s + r.amount, 0);

	function adopt() {
		startTransition(async () => {
			const result =
				offlineError() ??
				(await adoptPlanDefaults(workspaceId, chosen).catch(() => ({ error: NEEDS_CONNECTION })));
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<section aria-labelledby="plan-start" className="max-w-xl animate-rise space-y-4">
			<div className="space-y-1">
				<h2 id="plan-start" className="text-base font-medium">
					Plan your month
				</h2>
				<p className="text-sm text-muted-foreground">
					{suggestions.length > 0
						? "Here's what each category cost on average over the last three months. Keep, change or untick, then plan with these — every month gets them until you change one."
						: "Plan a category to start: what you mean to spend on it each month."}
				</p>
			</div>

			{rows.length > 0 && (
				<>
					<ol className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
						{rows.map((r, i) => (
							<li key={r.accountId} className="flex items-center gap-3 py-2">
								<Checkbox
									id={`suggest-${r.accountId}`}
									checked={r.use}
									onCheckedChange={(v) =>
										setRows((all) => all.map((x, j) => (j === i ? { ...x, use: v === true } : x)))
									}
								/>
								<label
									htmlFor={`suggest-${r.accountId}`}
									className="min-w-0 flex-1 truncate text-sm"
								>
									{r.name}
									<span className="text-xs text-muted-foreground">
										{" "}
										· avg {formatCurrency(r.average, currency)}
									</span>
								</label>
								<Input
									aria-label={`Plan for ${r.name}`}
									inputMode="decimal"
									autoComplete="off"
									disabled={!r.use}
									value={r.amount}
									onChange={(e) =>
										setRows((all) =>
											all.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
										)
									}
									className="w-28 text-right font-figures"
								/>
							</li>
						))}
					</ol>
					<div className="flex items-center justify-between gap-3">
						<p className="font-figures text-sm text-muted-foreground">
							{formatCurrency(total, currency)} a month
						</p>
						<Button onClick={adopt} disabled={pending || chosen.length === 0} className="gap-1.5">
							{pending && <Spinner />}
							{pending ? "Saving…" : `Plan with these ${chosen.length}`}
						</Button>
					</div>
				</>
			)}
		</section>
	);
}
