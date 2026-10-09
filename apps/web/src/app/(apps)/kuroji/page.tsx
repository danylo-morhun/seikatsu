import { auth } from "@/auth";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getBalances } from "@/features/kuroji/actions/balances";
import { getTags } from "@/features/kuroji/actions/tags";
import { getRecentTransactions, hasAnyTransactions } from "@/features/kuroji/actions/transactions";
import { getMonthlyTrends } from "@/features/kuroji/actions/trends";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { AccountsOverview } from "@/features/kuroji/components/AccountsOverview";
import { CategoryBreakdown } from "@/features/kuroji/components/CategoryBreakdown";
import { ExpensesEmptyState } from "@/features/kuroji/components/ExpensesEmptyState";
import type { KurojiTab } from "@/features/kuroji/components/KurojiNavTabs";
import { MonthlyFlow } from "@/features/kuroji/components/MonthlyFlow";
import { OnboardingCard } from "@/features/kuroji/components/OnboardingCard";
import { OverviewFigures } from "@/features/kuroji/components/OverviewFigures";
import { TransactionTable } from "@/features/kuroji/components/TransactionTable";
import { displayBalance, rollupRoots } from "@/features/kuroji/lib/balance";
import { parseLocal } from "@/features/kuroji/lib/dates";
import { asOfLabel, periodQuery, resolvePeriod } from "@/features/kuroji/lib/period";
import { generateDueForWorkspace } from "@/features/kuroji/lib/recurring-runner";
import type { TransactionFilters } from "@/features/kuroji/lib/transaction-filters";
import { getUserToday } from "@/lib/timezone";
import { format, subMonths } from "date-fns";
import { redirect } from "next/navigation";
import { after } from "next/server";

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

		const [balances, trendData, started] = await Promise.all([
			getBalances(workspace.id, from, to),
			getMonthlyTrends(
				workspace.id,
				hasDateFilter ? from : undefined,
				hasDateFilter ? to : undefined,
				trendMonths,
			),
			hasAnyTransactions(workspace.id),
		]);

		// Each entry counted once: rollup roots only (a child under a same-type parent is
		// already in the parent's balance; one under another type's parent is not).
		const roots = rollupRoots(balances);
		const topLevel = (type: string, excludeOpeningBalance = false) =>
			roots
				.filter(
					(b) =>
						b.type === type &&
						!b.hidden &&
						(!excludeOpeningBalance || b.name !== "Opening Balance"),
				)
				.reduce((acc, b) => acc + Number(b.balance), 0);
		const income = displayBalance("INCOME", topLevel("INCOME"));
		const expenses = displayBalance("EXPENSE", topLevel("EXPENSE"));
		const assets = topLevel("ASSET");
		// Liabilities are stored negative; shown as what is owed (an overpaid one goes negative).
		const liabilities = displayBalance("LIABILITY", topLevel("LIABILITY", true));
		const query = periodQuery(
			new URLSearchParams(
				Object.entries({ from: rawFrom, to: rawTo, all: rawAll }).filter(
					(e): e is [string, string] => !!e[1],
				),
			),
		);

		return (
			<main className="flex flex-col pb-28 md:pb-0">
				{!started ? (
					<div className="px-4 py-6 sm:px-8">
						<OnboardingCard workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
					</div>
				) : (
					<div className="space-y-10 px-4 py-6 sm:px-8 md:py-8">
						<OverviewFigures
							currency={workspace.baseCurrency}
							periodLabel={period.label}
							assets={assets}
							liabilities={liabilities}
							income={income}
							expenses={expenses}
						/>

						<div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
							<section aria-labelledby="spending-title">
								<h2 id="spending-title" className="mb-3 text-sm font-medium">
									Where it went
								</h2>
								{income === 0 && expenses === 0 ? (
									<ExpensesEmptyState
										workspaceId={workspace.id}
										baseCurrency={workspace.baseCurrency}
										from={from}
										to={to}
									/>
								) : (
									<CategoryBreakdown
										balances={balances}
										currency={workspace.baseCurrency}
										periodQuery={query}
									/>
								)}
							</section>
							<MonthlyFlow
								data={trendData}
								currency={workspace.baseCurrency}
								trendParam={trendParam}
								hasDateFilter={hasDateFilter}
								searchParams={{ from: rawFrom, to: rawTo, all: rawAll }}
								range={{
									from:
										hasDateFilter && from
											? from.slice(0, 7)
											: format(subMonths(parseLocal(today), trendMonths - 1), "yyyy-MM"),
									to: hasDateFilter && to ? to.slice(0, 7) : today.slice(0, 7),
								}}
							/>
						</div>
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
	const filters: TransactionFilters = {
		from,
		to,
		accountIds: accountId ? [accountId] : undefined,
		tagId,
		q,
		sortField,
		sortDir,
	};
	const [recentTransactions, accounts, allTags] = await Promise.all([
		getRecentTransactions(workspace.id, filters, pageNum),
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
					filters={filters}
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
