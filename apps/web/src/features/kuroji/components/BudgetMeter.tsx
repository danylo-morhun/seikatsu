import { formatCurrency } from "@/features/kuroji/lib/format";
import { cn } from "@seikatsu/ui";

interface Props {
	/** Spent (expense budget) or earned (income target) so far, never negative. */
	used: number;
	limit: number;
	kind: "budget" | "target";
	currency: string;
	className?: string;
}

/**
 * A budget is a capacity that drains: full when nothing is spent, empty at the limit,
 * spilling red past it. A target fills up instead. Bar and words always say the same thing.
 */
export function BudgetMeter({ used, limit, kind, currency, className }: Props) {
	const over = used > limit;
	const ratio = Math.min(used / limit, 1);
	const fill = kind === "budget" ? (over ? 1 : 1 - ratio) : ratio;
	const label =
		kind === "budget"
			? over
				? `${formatCurrency(used - limit, currency)} over ${formatCurrency(limit, currency)}`
				: `${formatCurrency(limit - used, currency)} left of ${formatCurrency(limit, currency)}`
			: over || used === limit
				? `Target ${formatCurrency(limit, currency)} reached`
				: `${formatCurrency(used, currency)} of ${formatCurrency(limit, currency)}`;

	return (
		<div className={cn("flex items-center gap-3", className)}>
			<span aria-hidden className="relative h-1 flex-1 rounded-full bg-surface-2">
				<span
					className={cn(
						"absolute inset-y-0 left-0 rounded-full",
						kind === "budget" && over
							? "bg-negative"
							: kind === "target" && ratio >= 1
								? "bg-positive"
								: "bg-primary/80",
					)}
					style={{ width: `${fill * 100}%` }}
				/>
			</span>
			<span
				className={cn(
					"shrink-0 font-figures text-xs",
					kind === "budget" && over ? "text-negative" : "text-muted-foreground",
				)}
			>
				{label}
			</span>
		</div>
	);
}
