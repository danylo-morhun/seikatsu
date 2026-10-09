import { auth } from "@/auth";
import { getAccountActivity, getAccountDetail } from "@/features/kuroji/actions/account-detail";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getBalances } from "@/features/kuroji/actions/balances";
import { getRecentTransactions } from "@/features/kuroji/actions/transactions";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { AccountActivityChart } from "@/features/kuroji/components/AccountActivityChart";
import { AccountEditButton } from "@/features/kuroji/components/AccountEditButton";
import { TransactionTable } from "@/features/kuroji/components/TransactionTable";
import { displayBalance } from "@/features/kuroji/lib/balance";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { asOfLabel, resolvePeriod } from "@/features/kuroji/lib/period";
import { getUserToday } from "@/lib/timezone";
import { Progress, cn } from "@seikatsu/ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const TYPE_LABEL: Record<string, string> = {
	ASSET: "Asset",
	LIABILITY: "Liability",
	INCOME: "Income",
	EXPENSE: "Expense",
};

const TYPE_COLOR: Record<string, string> = {
	ASSET: "bg-blue-500/10 text-blue-400",
	LIABILITY: "bg-red-500/10 text-red-400",
	INCOME: "bg-green-500/10 text-green-400",
	EXPENSE: "bg-orange-500/10 text-orange-400",
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
	const [activity, balances, allAccounts] = await Promise.all([
		getAccountActivity(id),
		getBalances(workspace.id, period.from, period.to),
		getAccounts(workspace.id),
	]);

	const isStock = account.type === "ASSET" || account.type === "LIABILITY";
	const row = balances.find((b) => b.accountId === id);
	const balance = displayBalance(account.type, Number(row?.balance ?? 0));
	const nativeBalance = displayBalance(account.type, Number(row?.nativeBalance ?? 0));
	const isForeign = account.currency !== workspace.baseCurrency;
	const subAccounts = balances.filter((b) => b.parentId === id);
	const rolledUpIds = subAccounts
		.filter((b) => !b.hidden && b.type === account.type)
		.map((b) => b.accountId);
	const rolledUp = rolledUpIds.length;
	// The list covers what the balance covers: this period, this account and its rolled-up subs.
	const txResult = await getRecentTransactions(
		workspace.id,
		period.from,
		period.to,
		page,
		[id, ...rolledUpIds],
		q,
	);

	const budget = account.budget != null ? Number(account.budget) : null;
	const showBudget = !isStock && budget != null && budget > 0;
	const used = Math.max(balance, 0);
	const pct = showBudget ? Math.min((used / budget) * 100, 100) : null;
	const overBudget = showBudget && used > budget;

	const accountForEdit = allAccounts.find((a) => a.id === id);

	return (
		<main className="px-4 pt-6 pb-28 sm:px-6 md:pb-6">
			<div className="mb-6">
				<Link href="/kuroji" className="text-sm text-muted-foreground hover:text-foreground">
					← Back to dashboard
				</Link>
			</div>

			<div className="mb-8 flex items-start justify-between gap-4">
				<div>
					<div className="mb-2 flex items-center gap-2">
						<span
							className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLOR[account.type]}`}
						>
							{TYPE_LABEL[account.type]}
						</span>
					</div>
					<h1 className="text-2xl font-bold">{account.name}</h1>
					<p
						className={cn(
							"mt-1 text-3xl font-bold tracking-tight tabular-nums",
							balance < 0 && "text-destructive",
						)}
					>
						{isForeign
							? formatCurrency(nativeBalance, account.currency)
							: formatCurrency(balance, workspace.baseCurrency)}
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{isForeign && `≈ ${formatCurrency(balance, workspace.baseCurrency)} · `}
						{isStock ? asOfLabel(period.to, today) : period.label}
						{rolledUp > 0 && ` · incl. ${rolledUp} sub-account${rolledUp === 1 ? "" : "s"}`}
					</p>
				</div>
				{accountForEdit && (
					<AccountEditButton account={accountForEdit} workspaceId={workspace.id} />
				)}
			</div>

			{showBudget && pct !== null && (
				<div className="mb-8 rounded-lg border p-4">
					<div className="mb-2 flex items-center justify-between text-sm">
						<span className="font-medium">{account.type === "EXPENSE" ? "Budget" : "Target"}</span>
						<span className={overBudget ? "text-destructive" : "text-muted-foreground"}>
							{formatCurrency(used, workspace.baseCurrency)} /{" "}
							{formatCurrency(budget!, workspace.baseCurrency)}
							{overBudget && " · over budget"}
						</span>
					</div>
					<Progress
						value={pct}
						className="h-2"
						indicatorClassName={overBudget ? "bg-destructive" : undefined}
					/>
				</div>
			)}

			<div className="space-y-6">
				<AccountActivityChart data={activity} currency={workspace.baseCurrency} />

				{subAccounts.length > 0 && (
					<section>
						<h2 className="mb-3 text-base font-semibold">Sub-accounts</h2>
						<div className="rounded-lg border divide-y">
							{subAccounts.map((sub) => {
								const subBalance = displayBalance(sub.type, Number(sub.balance));
								return (
									<div key={sub.accountId} className="flex items-center justify-between px-4 py-3">
										<Link
											href={`/kuroji/accounts/${sub.accountId}`}
											className="text-sm font-medium hover:underline"
										>
											{sub.name}
										</Link>
										<span
											className={cn(
												"text-sm tabular-nums",
												subBalance < 0 ? "text-destructive" : "text-muted-foreground",
											)}
										>
											{formatCurrency(subBalance, workspace.baseCurrency)}
										</span>
									</div>
								);
							})}
						</div>
					</section>
				)}

				<TransactionTable
					transactions={txResult.rows}
					currency={workspace.baseCurrency}
					workspaceId={workspace.id}
					page={page}
					hasMore={txResult.hasMore}
					total={txResult.total}
					accountFilterId={id}
					accountFilterName={account.name}
					searchQuery={q}
					dateFrom={period.from}
					dateTo={period.to}
				/>
			</div>
		</main>
	);
}
