import { auth } from "@/auth";
import { UnderlineTab, UnderlineTabs } from "@/components/UnderlineTabs";
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
import { redirect } from "next/navigation";

const SECTIONS = [
	{ id: "general", label: "General" },
	{ id: "accounts", label: "Accounts" },
	{ id: "recurring", label: "Recurring" },
	{ id: "banks", label: "Banks & import" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

function SectionHeader({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="mb-4 flex items-start justify-between gap-4">
			<div className="min-w-0">
				<h2 className="text-base font-semibold">{title}</h2>
				<p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
			</div>
			{action}
		</div>
	);
}

export default async function KurojiSettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ section?: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const { section: rawSection } = await searchParams;
	const section: SectionId = SECTIONS.some((s) => s.id === rawSection)
		? (rawSection as SectionId)
		: "general";

	const workspace = await initializeWorkspace(session.user.id);
	// Only what the open section shows is fetched.
	const allAccounts = await getAccounts(workspace.id, { includeArchived: true });
	const accounts = allAccounts.filter((a) => a.archivedAt === null);

	let body: React.ReactNode;
	if (section === "general") {
		body = (
			<section>
				<SectionHeader
					title="Workspace"
					description="Name and the base currency every balance is converted to."
				/>
				<WorkspaceSettingsForm
					workspaceId={workspace.id}
					initialName={workspace.name}
					baseCurrency={workspace.baseCurrency}
				/>
			</section>
		);
	} else if (section === "accounts") {
		const balances = await getBalances(workspace.id, undefined, undefined);
		body = (
			<section>
				<SectionHeader
					title="Accounts"
					description="What you own and owe, and the categories money comes from and goes to."
					action={
						<AddAccountModal workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
					}
				/>
				<AccountsOverview
					balances={balances}
					accounts={accounts}
					currency={workspace.baseCurrency}
					workspaceId={workspace.id}
					periodLabel="All time"
					hideHeader
					listMode
				/>
				<ArchivedAccountsList accounts={allAccounts.filter((a) => a.archivedAt !== null)} />
			</section>
		);
	} else if (section === "recurring") {
		const recurringItems = await getRecurringTransactions(workspace.id);
		body = (
			<section>
				<SectionHeader
					title="Recurring"
					description="Recorded automatically on their dates, every morning."
					action={
						<AddRecurringModal workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
					}
				/>
				<RecurringTransactionsList items={recurringItems} currency={workspace.baseCurrency} />
			</section>
		);
	} else {
		const [bankConnections, bankRules] = await Promise.all([
			getBankConnections(workspace.id),
			getBankRules(workspace.id),
		]);
		body = (
			<div className="space-y-12">
				<section>
					<SectionHeader
						title="Bank connections"
						description="Open Banking imports, synced daily."
					/>
					<BankConnectionsSection
						workspaceId={workspace.id}
						connections={bankConnections}
						accounts={accounts}
					/>
				</section>
				<section>
					<SectionHeader
						title="Privat24 statement"
						description="PrivatBank has no API for personal cards; import the .xlsx the Privat24 app exports."
					/>
					<Privat24ImportSection workspaceId={workspace.id} accounts={accounts} />
				</section>
				<section>
					<SectionHeader
						title="Import rules"
						description="Categorize imported transactions by keyword."
					/>
					<BankRulesManager workspaceId={workspace.id} rules={bankRules} accounts={accounts} />
				</section>
			</div>
		);
	}

	return (
		<div className="max-w-3xl px-4 pt-6 pb-28 sm:px-8 md:pt-8 md:pb-8">
			<h1 className="text-xl font-semibold">黒 Kuroji</h1>
			<div className="mt-4 mb-8">
				<UnderlineTabs label="Kuroji settings">
					{SECTIONS.map((s) => (
						<UnderlineTab
							key={s.id}
							href={s.id === "general" ? "/settings/kuroji" : `/settings/kuroji?section=${s.id}`}
							current={section === s.id}
						>
							{s.label}
						</UnderlineTab>
					))}
				</UnderlineTabs>
			</div>
			{body}
		</div>
	);
}
