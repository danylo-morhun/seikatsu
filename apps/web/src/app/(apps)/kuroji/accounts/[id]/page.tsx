import { auth } from "@/auth";
import { getAccountActivity, getAccountDetail } from "@/features/kuroji/actions/account-detail";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getBalances } from "@/features/kuroji/actions/balances";
import { getRecentTransactions } from "@/features/kuroji/actions/transactions";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { AccountActivityChart } from "@/features/kuroji/components/AccountActivityChart";
import { AccountEditButton } from "@/features/kuroji/components/AccountEditButton";
import { BudgetMeter } from "@/features/kuroji/components/BudgetMeter";
import { TransactionTable } from "@/features/kuroji/components/TransactionTable";
import { accountScope, displayBalance } from "@/features/kuroji/lib/balance";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { asOfLabel, resolvePeriod } from "@/features/kuroji/lib/period";
import type { TransactionFilters } from "@/features/kuroji/lib/transaction-filters";
import { getUserToday } from "@/lib/timezone";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const TYPE_LABEL: Record<string, string> = {
	ASSET: "Asset",
	LIABILITY: "Liability",
	INCOME: "Income",
	EXPENSE: "Expense",
};

export default async function AccountDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ page?: string; q?: string; from?: string; to?: string; all?: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const { id } = await params;
	const { page: rawPage, q: rawQ, from: rawFrom, to: rawTo, all: rawAll } = await searchParams;
	const page = rawPage && /^\d+$/.test(rawPage) ? Math.max(0, Number.parseInt(rawPage, 10)) : 0;
	const q = rawQ?.trim() || undefined;

	const [workspace, account, today] = await Promise.all([
		initializeWorkspace(session.user.id),
		getAccountDetail(id),
		getUserToday(),
	]);
	if (!account || account.workspaceId !== workspace.id) notFound();

	// Same balances (period, sub-account rollup, FX revaluation) as the Accounts tab.
	const period = resolvePeriod({ from: rawFrom, to: rawTo, all: rawAll }, today);
	const [balances, allAccounts] = await Promise.all([
		getBalances(workspace.id, period.from, period.to),
		getAccounts(workspace.id),
	]);

	const isStock = account.type === "ASSET" || account.type === "LIABILITY";
	const row = balances.find((b) => b.accountId === id);
	const balance = displayBalance(account.type, Number(row?.balance ?? 0));
	const nativeBalance = displayBalance(account.type, Number(row?.nativeBalance ?? 0));
	const isForeign = account.currency !== workspace.baseCurrency;
	const subAccounts = balances.filter((b) => b.parentId === id);
	const scope = accountScope(id, account.type, balances);
	const rolledUp = scope.length - 1;
	// The list covers what the balance covers: this period, this account and its rolled-up subs.
	const filters: TransactionFilters = {
		from: period.from,
		to: period.to,
		accountIds: scope,
		q,
	};
	const [txResult, activity] = await Promise.all([
		getRecentTransactions(workspace.id, filters, page),
		getAccountActivity(workspace.id, scope),
	]);

	const budget = account.budget != null ? Number(account.budget) : null;
	const showBudget = !isStock && budget != null && budget > 0;
	const used = Math.max(balance, 0);

	const accountForEdit = allAccounts.find((a) => a.id === id);

	// Links out of this page (back to the list, into a sub-account) keep the period.
	const periodParams = [
		rawAll === "1" ? "all=1" : null,
		rawAll !== "1" && rawFrom ? `from=${rawFrom}` : null,
		rawAll !== "1" && rawTo ? `to=${rawTo}` : null,
	]
		.filter(Boolean)
		.join("&");
	const withPeriod = (href: string) =>
		periodParams ? `${href}${href.includes("?") ? "&" : "?"}${periodParams}` : href;

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:pt-8 md:pb-8">
			<div className="mb-6">
				<Link
					href={withPeriod("/kuroji?tab=accounts")}
					prefetch
					className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden className="size-4" />
					Accounts
				</Link>
			</div>

			<div className="mb-10 flex items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="text-xs text-muted-foreground">{TYPE_LABEL[account.type]}</p>
					<h1 className="mt-0.5 truncate text-xl font-semibold">{account.name}</h1>
					<p
						className={cn(
							"mt-3 font-figures text-4xl font-semibold tracking-tight",
							balance < 0 && "text-negative",
						)}
					>
						{isForeign
							? formatCurrency(nativeBalance, account.currency)
							: formatCurrency(balance, workspace.baseCurrency)}
					</p>
					<p className="mt-1.5 text-sm text-muted-foreground">
						{isForeign && `≈ ${formatCurrency(balance, workspace.baseCurrency)} · `}
						{isStock ? asOfLabel(period.to, today) : period.label}
						{rolledUp > 0 && ` · incl. ${rolledUp} sub-account${rolledUp === 1 ? "" : "s"}`}
					</p>
				</div>
				{accountForEdit && (
					<AccountEditButton account={accountForEdit} workspaceId={workspace.id} />
				)}
			</div>

			{showBudget && (
				<section aria-label={account.type === "EXPENSE" ? "Budget" : "Target"} className="mb-10">
					<p className="mb-2 text-sm font-medium">
						{account.type === "EXPENSE" ? "Budget" : "Target"}
					</p>
					<BudgetMeter
						used={used}
						limit={budget!}
						kind={account.type === "EXPENSE" ? "budget" : "target"}
						currency={workspace.baseCurrency}
					/>
				</section>
			)}

			<div className="space-y-10">
				<div className={cn("grid gap-10", subAccounts.length > 0 && "lg:grid-cols-2 lg:gap-12")}>
					<AccountActivityChart
						data={activity}
						currency={workspace.baseCurrency}
						type={account.type}
					/>

					{subAccounts.length > 0 && (
						<section aria-labelledby="subs-title">
							<h2 id="subs-title" className="mb-3 text-sm font-medium">
								Sub-accounts
							</h2>
							<ul className="divide-y divide-rule border-y border-rule">
								{subAccounts.map((sub) => {
									const subBalance = displayBalance(sub.type, Number(sub.balance));
									return (
										<li key={sub.accountId}>
											<Link
												href={withPeriod(`/kuroji/accounts/${sub.accountId}`)}
												prefetch
												className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-surface"
											>
												<span className="truncate">{sub.name}</span>
												<span
													className={cn(
														"font-figures",
														subBalance < 0 ? "text-negative" : "text-muted-foreground",
													)}
												>
													{formatCurrency(subBalance, workspace.baseCurrency)}
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						</section>
					)}
				</div>

				<TransactionTable
					transactions={txResult.rows}
					currency={workspace.baseCurrency}
					workspaceId={workspace.id}
					page={txResult.page}
					hasMore={txResult.hasMore}
					total={txResult.total}
					filters={filters}
					accountFilterId={id}
					accountFilterName={account.name}
					searchQuery={q}
					dateFrom={period.from}
					dateTo={period.to}
				/>
			</div>
		</div>
	);
}
