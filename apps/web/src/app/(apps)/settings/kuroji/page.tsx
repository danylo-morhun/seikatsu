import { auth } from "@/auth";
import { PageTab, PageTabs } from "@/components/PageTabs";
import { SettingsPage, SettingsSection } from "@/components/SettingsSection";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getBalances } from "@/features/kuroji/actions/balances";
import { getBankConnections, getBankRules } from "@/features/kuroji/actions/bank";
import { getCaptureKeyStatus } from "@/features/kuroji/actions/capture";
import { getRecurringTransactions } from "@/features/kuroji/actions/recurring";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { AccountsOverview } from "@/features/kuroji/components/AccountsOverview";
import { AddAccountModal } from "@/features/kuroji/components/AddAccountModal";
import { AddRecurringModal } from "@/features/kuroji/components/AddRecurringModal";
import { ApplePaySection } from "@/features/kuroji/components/ApplePaySection";
import { ArchivedAccountsList } from "@/features/kuroji/components/ArchivedAccountsList";
import {
	BankConnectionsSection,
	ConnectBankButton,
} from "@/features/kuroji/components/BankConnectionsSection";
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
			<SettingsSection
				title="Workspace"
				description="Its name, and the currency every balance is converted to."
			>
				<WorkspaceSettingsForm
					workspaceId={workspace.id}
					initialName={workspace.name}
					baseCurrency={workspace.baseCurrency}
				/>
			</SettingsSection>
		);
	} else if (section === "accounts") {
		const balances = await getBalances(workspace.id, undefined, undefined);
		body = (
			<>
				<SettingsSection
					description="What you own and owe, and the categories money comes from and goes to."
					action={
						<AddAccountModal workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
					}
				>
					<AccountsOverview
						balances={balances}
						accounts={accounts}
						currency={workspace.baseCurrency}
						workspaceId={workspace.id}
						periodLabel="All time"
						hideHeader
						listMode
					/>
				</SettingsSection>
				<ArchivedAccountsList accounts={allAccounts.filter((a) => a.archivedAt !== null)} />
			</>
		);
	} else if (section === "recurring") {
		const recurringItems = await getRecurringTransactions(workspace.id);
		body = (
			<SettingsSection
				description="Subscriptions, rent, salary: recorded on their dates, every morning."
				action={
					<AddRecurringModal workspaceId={workspace.id} baseCurrency={workspace.baseCurrency} />
				}
			>
				<RecurringTransactionsList items={recurringItems} currency={workspace.baseCurrency} />
			</SettingsSection>
		);
	} else {
		const [bankConnections, bankRules, captureKey] = await Promise.all([
			getBankConnections(workspace.id),
			getBankRules(workspace.id),
			getCaptureKeyStatus(workspace.id),
		]);
		body = (
			<>
				<SettingsSection
					title="Bank connections"
					description="Polish banks over Open Banking; new transactions arrive daily."
					action={<ConnectBankButton workspaceId={workspace.id} />}
				>
					<BankConnectionsSection
						workspaceId={workspace.id}
						connections={bankConnections}
						accounts={accounts}
					/>
				</SettingsSection>
				<SettingsSection
					title="Apple Pay"
					description="An iPhone Shortcut sends each payment here; tap its notification to add it. The bank import later matches it instead of adding it twice."
				>
					<ApplePaySection workspaceId={workspace.id} status={captureKey} />
				</SettingsSection>
				<SettingsSection
					title="Privat24 statement"
					description="PrivatBank has no API for personal cards, so import the .xlsx the Privat24 app exports."
				>
					<Privat24ImportSection workspaceId={workspace.id} accounts={accounts} />
				</SettingsSection>
				<SettingsSection
					title="Import rules"
					description="An imported transaction whose description has a keyword goes to its category; the rest go to Uncategorized."
				>
					<BankRulesManager workspaceId={workspace.id} rules={bankRules} accounts={accounts} />
				</SettingsSection>
			</>
		);
	}

	return (
		<SettingsPage
			title="黒 Kuroji"
			appNav
			tabs={
				<PageTabs label="Kuroji settings">
					{SECTIONS.map((s) => (
						<PageTab
							key={s.id}
							href={s.id === "general" ? "/settings/kuroji" : `/settings/kuroji?section=${s.id}`}
							current={section === s.id}
						>
							{s.label}
						</PageTab>
					))}
				</PageTabs>
			}
		>
			{body}
		</SettingsPage>
	);
}
