"use client";

import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { Button } from "@seikatsu/ui";
import Link from "next/link";

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
		<section aria-labelledby="welcome-title" className="max-w-2xl py-4 md:py-10">
			<p className="text-sm text-muted-foreground">黒 Kuroji</p>
			<h1 id="welcome-title" className="mt-1 text-2xl font-semibold md:text-3xl">
				Your ledger is ready.
			</h1>
			<p className="mt-3 max-w-prose text-muted-foreground">
				Every entry moves money from one account to another, so balances always add up. We set up a
				wallet, a bank account, savings and a few everyday categories to start with.
			</p>
			<div className="mt-6">
				<AddTransactionModal
					workspaceId={workspaceId}
					baseCurrency={baseCurrency}
					trigger={<Button size="lg">Record your first transaction</Button>}
				/>
			</div>

			<ol className="mt-12 divide-y divide-rule border-y border-rule">
				{STEPS.map((step, i) => (
					<li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-3 py-4">
						<span className="font-figures text-sm text-muted-foreground">{i + 1}</span>
						<span>
							<span className="block text-sm font-medium">{step.title}</span>
							<span className="mt-0.5 block text-sm text-muted-foreground">{step.body}</span>
						</span>
						{step.href && (
							<Button asChild variant="ghost" size="sm" className="self-center">
								<Link href={step.href} prefetch>
									{step.cta}
								</Link>
							</Button>
						)}
					</li>
				))}
			</ol>
		</section>
	);
}
