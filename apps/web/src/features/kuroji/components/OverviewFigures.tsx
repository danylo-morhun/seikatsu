import { formatCurrency } from "@/features/kuroji/lib/format";
import { cn } from "@seikatsu/ui";

interface Props {
	currency: string;
	periodLabel: string;
	assets: number;
	liabilities: number;
	income: number;
	expenses: number;
}

function Figure({
	label,
	value,
	currency,
	note,
	tone,
	lead = false,
}: {
	label: string;
	value: number;
	currency: string;
	note?: string;
	tone?: "positive" | "negative";
	lead?: boolean;
}) {
	return (
		<div className="min-w-0 py-1">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p
				data-total={lead ? "lead" : undefined}
				className={cn(
					"mt-1 truncate font-figures font-semibold tracking-tight",
					lead ? "text-4xl md:text-5xl" : "text-xl md:text-2xl",
					tone === "positive" && "text-positive",
					tone === "negative" && "text-negative",
				)}
			>
				{formatCurrency(value, currency)}
			</p>
			{note && <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p>}
		</div>
	);
}

/**
 * The period at a glance. Hierarchy comes from figure size, not boxes: net worth leads,
 * the period's flows follow, separated by hairlines.
 */
export function OverviewFigures({
	currency,
	periodLabel,
	assets,
	liabilities,
	income,
	expenses,
}: Props) {
	const netWorth = assets - liabilities;
	const net = income - expenses;

	return (
		<section
			aria-label="Summary"
			className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:divide-x md:divide-rule md:gap-0 md:[&>*]:px-6 md:[&>*:first-child]:pl-0"
		>
			<div className="col-span-2 md:col-span-1">
				<Figure
					lead
					label="Net worth"
					value={netWorth}
					currency={currency}
					tone={netWorth < 0 ? "negative" : undefined}
					note={
						// Debts only earn a mention when there are any.
						liabilities !== 0
							? `${formatCurrency(assets, currency)} assets · ${formatCurrency(liabilities, currency)} debts`
							: undefined
					}
				/>
			</div>
			<Figure
				label={`Income · ${periodLabel}`}
				value={income}
				currency={currency}
				tone="positive"
			/>
			<Figure label={`Expenses · ${periodLabel}`} value={expenses} currency={currency} />
			<div className="col-span-2 md:col-span-1">
				<Figure
					label="Net flow"
					value={net}
					currency={currency}
					tone={net < 0 ? "negative" : net > 0 ? "positive" : undefined}
					note={net < 0 ? "Spent more than earned" : net > 0 ? "Earned more than spent" : undefined}
				/>
			</div>
		</section>
	);
}
