import { auth } from "@/auth";
import {
	getAccountActivity,
	getAccountDetail,
	getSubAccounts,
} from "@/features/kuroji/actions/account-detail";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getRecentTransactions } from "@/features/kuroji/actions/transactions";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { AccountActivityChart } from "@/features/kuroji/components/AccountActivityChart";
import { AccountEditButton } from "@/features/kuroji/components/AccountEditButton";
import { TransactionTable } from "@/features/kuroji/components/TransactionTable";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { Progress } from "@seikatsu/ui";
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
	searchParams: Promise<{ page?: string; q?: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const { id } = await params;
	const { page: rawPage, q: rawQ } = await searchParams;
	const page = rawPage && /^\d+$/.test(rawPage) ? Math.max(0, Number.parseInt(rawPage, 10)) : 0;
	const q = rawQ?.trim() || undefined;

	const workspace = await initializeWorkspace(session.user.id);
	const account = await getAccountDetail(id);
	if (!account || account.workspaceId !== workspace.id) notFound();

	const [activity, subAccounts, txResult, allAccounts] = await Promise.all([
		getAccountActivity(id),
		getSubAccounts(id),
		getRecentTransactions(workspace.id, undefined, undefined, page, id, q),
		getAccounts(workspace.id),
	]);

	const balance = account.balance;
	const budget = account.budget != null ? Number(account.budget) : null;
	const showBudget =
		(account.type === "EXPENSE" || account.type === "INCOME") && budget != null && budget > 0;
	const pct = showBudget ? Math.min((Math.abs(balance) / budget) * 100, 100) : null;
	const overBudget = showBudget && Math.abs(balance) > budget;

	const accountForEdit = allAccounts.find((a) => a.id === id);

	return (
		<main className="px-4 py-6 sm:px-6">
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
						className={`mt-1 text-3xl font-bold tracking-tight ${balance < 0 ? "text-destructive" : ""}`}
					>
						{formatCurrency(Math.abs(balance), workspace.baseCurrency)}
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
							{formatCurrency(Math.abs(balance), workspace.baseCurrency)} /{" "}
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
							{subAccounts.map((sub) => (
								<div key={sub.id} className="flex items-center justify-between px-4 py-3">
									<Link
										href={`/kuroji/accounts/${sub.id}`}
										className="text-sm font-medium hover:underline"
									>
										{sub.name}
									</Link>
									<span className="text-sm text-muted-foreground">
										{formatCurrency(Math.abs(sub.balance), workspace.baseCurrency)}
									</span>
								</div>
							))}
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
				/>
			</div>
		</main>
	);
}
