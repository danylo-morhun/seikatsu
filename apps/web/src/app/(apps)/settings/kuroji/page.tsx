import { auth } from "@/auth";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getBalances } from "@/features/kuroji/actions/balances";
import { getBankConnections, getBankRules } from "@/features/kuroji/actions/bank";
import { getRecurringTransactions } from "@/features/kuroji/actions/recurring";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { AccountsOverview } from "@/features/kuroji/components/AccountsOverview";
import { AddAccountModal } from "@/features/kuroji/components/AddAccountModal";
import { AddRecurringModal } from "@/features/kuroji/components/AddRecurringModal";
import { ArchivedAccountsList } from "@/features/kuroji/components/ArchivedAccountsList";
import { BankConnectionsSection } from "@/features/kuroji/components/BankConnectionsSection";
import { BankRulesManager } from "@/features/kuroji/components/BankRulesManager";
import { Privat24ImportSection } from "@/features/kuroji/components/Privat24ImportSection";
import { RecurringTransactionsList } from "@/features/kuroji/components/RecurringTransactionsList";
import { WorkspaceSettingsForm } from "@/features/kuroji/components/WorkspaceSettingsForm";
import { Separator } from "@seikatsu/ui";
import { redirect } from "next/navigation";

export default async function KurojiSettingsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace = await initializeWorkspace(session.user.id);
	const [accounts, archivedAccounts, balances, recurringItems, bankConnections, bankRules] =
		await Promise.all([
			getAccounts(workspace.id),
			getAccounts(workspace.id, { includeArchived: true }).then((all) =>
				all.filter((a) => a.archivedAt !== null),
			),
			getBalances(workspace.id, undefined, undefined),
			getRecurringTransactions(workspace.id),
			getBankConnections(workspace.id),
			getBankRules(workspace.id),
		]);

	return (
		<main className="px-4 py-6 sm:px-6 max-w-3xl">
			<h1 className="mb-8 text-2xl font-semibold">黒 Kuroji</h1>

			<section className="mb-10">
				<h2 className="mb-1 text-base font-semibold">Workspace</h2>
				<p className="mb-4 text-sm text-muted-foreground">
					Your personal finance workspace settings.
				</p>
				<WorkspaceSettingsForm
					workspaceId={workspace.id}
					initialName={workspace.name}
					baseCurrency={workspace.baseCurrency}
				/>
			</section>

			<Separator className="my-8" />

			<section>
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold">Accounts</h2>
						<p className="text-sm text-muted-foreground">
							Manage your asset, liability, income and expense accounts.
						</p>
					</div>
					<AddAccountModal workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
				</div>
				<AccountsOverview
					balances={balances}
					accounts={accounts}
					currency={workspace.baseCurrency}
					workspaceId={workspace.id}
					periodLabel="All time"
					hideHeader
					listMode
				/>
				<ArchivedAccountsList accounts={archivedAccounts} />
			</section>

			<Separator className="my-8" />

			<section>
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold">Recurring Transactions</h2>
						<p className="text-sm text-muted-foreground">
							Automatically recorded on their scheduled dates when you visit.
						</p>
					</div>
					<AddRecurringModal workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
				</div>
				<RecurringTransactionsList items={recurringItems} currency={workspace.baseCurrency} />
			</section>

			<Separator className="my-8" />

			<section>
				<div className="mb-4">
					<h2 className="text-base font-semibold">Bank Connections</h2>
					<p className="text-sm text-muted-foreground">
						Connect a bank via Open Banking to import transactions automatically (synced daily).
					</p>
				</div>
				<BankConnectionsSection
					workspaceId={workspace.id}
					connections={bankConnections}
					accounts={accounts}
				/>
			</section>

			<Separator className="my-8" />

			<section>
				<div className="mb-4">
					<h2 className="text-base font-semibold">Import Privat24 statement</h2>
					<p className="text-sm text-muted-foreground">
						PrivatBank has no API for personal cards — import the .xlsx statement the Privat24 app
						exports instead.
					</p>
				</div>
				<Privat24ImportSection workspaceId={workspace.id} accounts={accounts} />
			</section>

			<Separator className="my-8" />

			<section>
				<div className="mb-4">
					<h2 className="text-base font-semibold">Import Rules</h2>
					<p className="text-sm text-muted-foreground">
						Auto-categorize imported bank transactions by keyword.
					</p>
				</div>
				<BankRulesManager workspaceId={workspace.id} rules={bankRules} accounts={accounts} />
			</section>
		</main>
	);
}
