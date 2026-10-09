import type { AccountActivity } from "@/features/kuroji/actions/account-detail";
import type { AccountType } from "@/features/kuroji/lib/balance";
import { formatCurrency } from "@/features/kuroji/lib/format";

// What the ledger's two sides mean for each kind of account, normal side first.
// `credit` holds positive base amounts, `debit` negative ones (as magnitudes).
const SIDES: Record<AccountType, { normal: "credit" | "debit"; labels: [string, string] }> = {
	ASSET: { normal: "credit", labels: ["In", "Out"] },
	EXPENSE: { normal: "credit", labels: ["Spent", "Refunded"] },
	INCOME: { normal: "debit", labels: ["Earned", "Reversed"] },
	LIABILITY: { normal: "debit", labels: ["Borrowed", "Repaid"] },
};

interface Props {
	data: AccountActivity[];
	currency: string;
	type: AccountType;
}

function monthLabel(month: string) {
	return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
		new Date(`${month}-01T00:00:00Z`),
	);
}

/** The last six months of movement, one row per month, in the account's own words. */
export function AccountActivityChart({ data, currency, type }: Props) {
	const { normal, labels } = SIDES[type];
	const other = normal === "credit" ? "debit" : "credit";
	const months = [...data].reverse();
	const max = Math.max(1, ...months.flatMap((m) => [m.credit, m.debit]));

	return (
		<section aria-labelledby="activity-title">
			<h2 id="activity-title" className="mb-3 text-sm font-medium">
				Last 6 months
			</h2>
			{months.length === 0 ? (
				<p className="py-4 text-sm text-muted-foreground">No movement in the last six months.</p>
			) : (
				<ol className="divide-y divide-rule border-y border-rule">
					{months.map((m) => (
						<li
							key={m.month}
							className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5"
						>
							<span className="text-xs text-muted-foreground">{monthLabel(m.month)}</span>
							<span aria-hidden className="flex flex-col gap-1">
								<span className="h-1.5 rounded-full bg-surface-2">
									<span
										className="block h-full rounded-full bg-primary/80"
										style={{ width: `${(m[normal] / max) * 100}%` }}
									/>
								</span>
								{m[other] > 0 && (
									<span className="h-1.5 rounded-full bg-surface-2">
										<span
											className="block h-full rounded-full bg-muted-foreground/50"
											style={{ width: `${(m[other] / max) * 100}%` }}
										/>
									</span>
								)}
							</span>
							<span className="text-right font-figures text-sm">
								<span className="block">
									<span className="sr-only">{labels[0]} </span>
									{formatCurrency(m[normal], currency)}
								</span>
								{m[other] > 0 && (
									<span className="block text-xs text-muted-foreground">
										{labels[1]} {formatCurrency(m[other], currency)}
									</span>
								)}
							</span>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
