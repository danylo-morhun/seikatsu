"use client";

import { AppWelcome } from "@/components/AppWelcome";
import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { Button } from "@seikatsu/ui";

interface Props {
	workspaceId: string;
	baseCurrency: string;
}

const STEPS = [
	{
		title: "Record what you spent today",
		body: "Amount first, then the category and the account it came from. Kuroji remembers them for next time.",
	},
	{
		title: "Make the accounts yours",
		body: "Rename the starters, add your cards and the categories you actually use.",
		href: "/settings/kuroji?section=accounts",
		cta: "Edit accounts",
	},
	{
		title: "Let the bank fill it in",
		body: "Connect a bank or import a statement; rules file transactions into categories.",
		href: "/settings/kuroji?section=banks",
		cta: "Banks & import",
	},
];

/**
 * First run. The workspace already has starter accounts, so there is nothing to set up
 * before the first entry: lead with recording one, and point at the rest.
 */
export function OnboardingCard({ workspaceId, baseCurrency }: Props) {
	return (
		<AppWelcome
			app="/kuroji"
			title="Your ledger is ready."
			lead={`Where the money comes from and where it goes, in ${baseCurrency} or any other currency. Every entry moves money from one account to another, so balances always add up. A wallet, a bank account, savings and a few everyday categories are already set up.`}
			steps={STEPS}
		>
			<AddTransactionModal
				workspaceId={workspaceId}
				baseCurrency={baseCurrency}
				trigger={<Button aria-keyshortcuts="N">Record your first transaction</Button>}
			/>
		</AppWelcome>
	);
}
