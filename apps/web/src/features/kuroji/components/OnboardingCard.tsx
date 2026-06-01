"use client";

import { AddAccountModal } from "@/features/kuroji/components/AddAccountModal";
import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { Card, CardContent } from "@seikatsu/ui";

const STEPS = [
	{
		num: 1,
		title: "Add a wallet",
		description: "Create a bank account, cash wallet, or credit card.",
	},
	{
		num: 2,
		title: "Add categories",
		description: "Create income sources (e.g. Salary) and expense categories (e.g. Groceries).",
	},
	{
		num: 3,
		title: "Record a transaction",
		description: "Log your first income or expense to see your dashboard come alive.",
	},
];

interface Props {
	workspaceId: string;
	baseCurrency: string;
	accountCount: number;
}

export function OnboardingCard({ workspaceId, baseCurrency, accountCount }: Props) {
	const step = accountCount === 0 ? 1 : accountCount < 3 ? 2 : 3;

	return (
		<Card className="border-dashed">
			<CardContent className="py-10">
				<div className="mx-auto max-w-md text-center">
					<h2 className="mb-2 text-lg font-semibold">Welcome to Kuroji</h2>
					<p className="mb-8 text-sm text-muted-foreground">
						Follow these steps to set up your personal finance tracker.
					</p>

					<ol className="mb-8 space-y-4 text-left">
						{STEPS.map((s) => (
							<li key={s.num} className={`flex gap-3 ${s.num < step ? "opacity-40" : ""}`}>
								<span
									className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
										s.num === step
											? "bg-primary text-primary-foreground"
											: s.num < step
												? "bg-muted text-muted-foreground"
												: "border text-muted-foreground"
									}`}
								>
									{s.num < step ? "✓" : s.num}
								</span>
								<div>
									<p className="text-sm font-medium">{s.title}</p>
									<p className="text-xs text-muted-foreground">{s.description}</p>
								</div>
							</li>
						))}
					</ol>

					<div className="flex justify-center gap-3">
						{step <= 2 && <AddAccountModal workspaceId={workspaceId} baseCurrency={baseCurrency} />}
						{step === 3 && (
							<AddTransactionModal workspaceId={workspaceId} baseCurrency={baseCurrency} />
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
