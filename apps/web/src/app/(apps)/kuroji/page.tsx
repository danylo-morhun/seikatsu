import { auth } from "@/auth";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getBalances } from "@/features/kuroji/actions/balances";
import { getTags } from "@/features/kuroji/actions/tags";
import { getRecentTransactions } from "@/features/kuroji/actions/transactions";
import { getMonthlyTrends } from "@/features/kuroji/actions/trends";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { AccountsOverview } from "@/features/kuroji/components/AccountsOverview";
import { ExpensesEmptyState } from "@/features/kuroji/components/ExpensesEmptyState";
import type { KurojiTab } from "@/features/kuroji/components/KurojiNavTabs";
import { OnboardingCard } from "@/features/kuroji/components/OnboardingCard";
import { TransactionTable } from "@/features/kuroji/components/TransactionTable";
import { displayBalance } from "@/features/kuroji/lib/balance";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { asOfLabel, resolvePeriod } from "@/features/kuroji/lib/period";
import { generateDueForWorkspace } from "@/features/kuroji/lib/recurring-runner";
import { getUserToday } from "@/lib/timezone";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { after } from "next/server";

// Charts (recharts) only render on the overview tab — split them out of the route bundle.
const ExpenseBreakdown = dynamic(() =>
	import("@/features/kuroji/components/ExpenseBreakdown").then((m) => m.ExpenseBreakdown),
);
const TrendChart = dynamic(() =>
	import("@/features/kuroji/components/TrendChart").then((m) => m.TrendChart),
);

const VALID_TABS: KurojiTab[] = ["expense", "accounts", "transactions"];

export default async function KurojiPage({
	searchParams,
}: {
	searchParams: Promise<{
		tab?: string;
		from?: string;
		to?: string;
		all?: string;
		page?: string;
		account?: string;
		q?: string;
		sort?: string;
		dir?: string;
		tag?: string;
		trend?: string;
	}>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const {
		tab: rawTab,
		from: rawFrom,
		to: rawTo,
		all: rawAll,
		page: rawPage,
		account: rawAccount,
		q: rawQ,
		sort: rawSort,
		dir: rawDir,
		tag: rawTag,
		trend: rawTrend,
	} = await searchParams;

	const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	const tab: KurojiTab = VALID_TABS.includes(rawTab as KurojiTab)
		? (rawTab as KurojiTab)
		: "expense";

	const today = await getUserToday();
	const period = resolvePeriod({ from: rawFrom, to: rawTo, all: rawAll }, today);
	const { from, to, hasDateFilter } = period;

	const pageNum = rawPage && /^\d+$/.test(rawPage) ? Math.max(0, Number.parseInt(rawPage, 10)) : 0;
	const accountId = rawAccount && UUID.test(rawAccount) ? rawAccount : undefined;
	const q = rawQ?.trim() || undefined;
	const sortField = rawSort === "amount" ? "amount" : "date";
	const sortDir = rawDir === "asc" ? "asc" : "desc";
	const tagId = rawTag && UUID.test(rawTag) ? rawTag : undefined;

	const workspace = await initializeWorkspace(session.user.id);
	// The daily cron materializes recurring transactions; this only covers a missed run,
	// after the response is sent, so it never delays the page.
	after(() => generateDueForWorkspace(workspace));

	// ── Overview ────────────────────────────────────────────────────────────────
	if (tab === "expense") {
		const trendParam = rawTrend === "3m" || rawTrend === "1y" ? rawTrend : "6m";
		const trendMonths = trendParam === "3m" ? 3 : trendParam === "1y" ? 12 : 6;

		const [balances, trendData] = await Promise.all([
			getBalances(workspace.id, from, to),
			getMonthlyTrends(
				workspace.id,
				hasDateFilter ? from : undefined,
				hasDateFilter ? to : undefined,
				trendMonths,
			),
		]);

		const topLevel = (type: string, excludeOpeningBalance = false) =>
			balances
				.filter(
					(b) =>
						b.type === type &&
						!b.parentId &&
						!b.hidden &&
						(!excludeOpeningBalance || b.name !== "Opening Balance"),
				)
				.reduce((acc, b) => acc + Number(b.balance), 0);
		const income = displayBalance("INCOME", topLevel("INCOME"));
		const expenses = displayBalance("EXPENSE", topLevel("EXPENSE"));
		// Ledger signs already net out: liabilities are stored negative, an overpaid one positive.
		const netWorth = topLevel("ASSET") + topLevel("LIABILITY", true);
		return (
			<main className="flex flex-col pb-28 md:pb-0">
				{balances.length === 0 ? (
					<div className="px-4 py-6 sm:px-6">
						<OnboardingCard
							workspaceId={workspace.id}
							baseCurrency={workspace.baseCurrency}
							accountCount={0}
						/>
					</div>
				) : (
					<div className="space-y-6 px-4 py-6 sm:px-6">
						<div className="flex flex-wrap items-center gap-4 sm:gap-6">
							<div>
								<p className="text-xs text-muted-foreground">Net Worth</p>
								<p className={`text-2xl font-bold ${netWorth < 0 ? "text-destructive" : ""}`}>
									{formatCurrency(netWorth, workspace.baseCurrency)}
								</p>
							</div>
							<div className="h-8 w-px bg-border" />
							<div>
								<p className="text-xs text-muted-foreground">Income</p>
								<p className="text-2xl font-bold text-green-500">
									{formatCurrency(income, workspace.baseCurrency)}
								</p>
							</div>
							<div className="h-8 w-px bg-border" />
							<div>
								<p className="text-xs text-muted-foreground">Expenses</p>
								<p className="text-2xl font-bold">
									{formatCurrency(expenses, workspace.baseCurrency)}
								</p>
							</div>
						</div>

						{income === 0 && expenses === 0 ? (
							<ExpensesEmptyState
								workspaceId={workspace.id}
								baseCurrency={workspace.baseCurrency}
							/>
						) : (
							<>
								<ExpenseBreakdown balances={balances} currency={workspace.baseCurrency} />
							</>
						)}
						<TrendChart
							data={trendData}
							currency={workspace.baseCurrency}
							trendParam={trendParam}
							hasDateFilter={hasDateFilter}
						/>
					</div>
				)}
			</main>
		);
	}

	// ── Accounts ────────────────────────────────────────────────────────────────
	if (tab === "accounts") {
		const [balances, accounts] = await Promise.all([
			getBalances(workspace.id, from, to),
			getAccounts(workspace.id),
		]);

		return (
			<main className="flex flex-col pb-28 md:pb-0">
				<div className="px-4 py-6 sm:px-6">
					<AccountsOverview
						balances={balances}
						accounts={accounts}
						currency={workspace.baseCurrency}
						workspaceId={workspace.id}
						periodLabel={period.label}
						asOfLabel={asOfLabel(to, today)}
					/>
				</div>
			</main>
		);
	}

	// ── Transactions ─────────────────────────────────────────────────────────────
	const [recentTransactions, accounts, allTags] = await Promise.all([
		getRecentTransactions(workspace.id, from, to, pageNum, accountId, q, sortField, sortDir, tagId),
		getAccounts(workspace.id),
		getTags(workspace.id),
	]);

	return (
		<main className="flex flex-col pb-28 md:pb-0">
			<div className="px-4 py-6 sm:px-6">
				<TransactionTable
					transactions={recentTransactions.rows}
					currency={workspace.baseCurrency}
					workspaceId={workspace.id}
					page={pageNum}
					hasMore={recentTransactions.hasMore}
					total={recentTransactions.total}
					accountFilterId={accountId}
					accountFilterName={accountId ? accounts.find((a) => a.id === accountId)?.name : undefined}
					tagFilterId={tagId}
					tagFilterName={tagId ? allTags.find((t) => t.id === tagId)?.name : undefined}
					searchQuery={q}
					dateFrom={from}
					dateTo={to}
					sortField={sortField}
					sortDir={sortDir}
				/>
			</div>
		</main>
	);
}
