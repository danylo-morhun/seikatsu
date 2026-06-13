"use client";

import { Spinner } from "@/components/Spinner";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import type { getBankRules } from "@/features/kuroji/actions/bank";
import { createBankRule, deleteBankRule } from "@/features/kuroji/actions/bank";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];
type Rule = Awaited<ReturnType<typeof getBankRules>>[number];

export function BankRulesManager({
	workspaceId,
	rules,
	accounts,
}: {
	workspaceId: string;
	rules: Rule[];
	accounts: Account[];
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [matchText, setMatchText] = useState("");
	const [accountId, setAccountId] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const categories = accounts.filter((a) => a.type === "INCOME" || a.type === "EXPENSE");
	const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";

	function handleAdd() {
		if (!matchText.trim() || !accountId) {
			toast.error("Enter a keyword and pick a category.");
			return;
		}
		startTransition(async () => {
			const result = await createBankRule(workspaceId, matchText, accountId);
			if ("error" in result) {
				toast.error(result.error);
			} else {
				toast.success("Rule added.");
				setMatchText("");
				setAccountId("");
				router.refresh();
			}
		});
	}

	function handleDelete(id: string) {
		setDeletingId(id);
		startTransition(async () => {
			const result = await deleteBankRule(id);
			if ("error" in result) toast.error(result.error);
			else router.refresh();
			setDeletingId(null);
		});
	}

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				When an imported transaction&apos;s description contains a keyword, it&apos;s filed under
				the matching category. Unmatched transactions go to Uncategorized.
			</p>

			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					placeholder="Keyword (e.g. Biedronka)"
					value={matchText}
					onChange={(e) => setMatchText(e.target.value)}
					className="sm:flex-1"
				/>
				<Select value={accountId} onValueChange={setAccountId}>
					<SelectTrigger className="sm:w-56">
						<SelectValue placeholder="Category" />
					</SelectTrigger>
					<SelectContent>
						{categories.map((a) => (
							<SelectItem key={a.id} value={a.id}>
								{a.name} ({a.type === "INCOME" ? "Income" : "Expense"})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button onClick={handleAdd} disabled={isPending} className="gap-1.5">
					{isPending && !deletingId && <Spinner />}
					Add rule
				</Button>
			</div>

			{rules.length > 0 && (
				<div className="divide-y rounded-md border">
					{rules.map((r) => (
						<div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
							<div className="flex min-w-0 items-center gap-2 text-sm">
								<span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
									{r.matchText}
								</span>
								<span className="text-muted-foreground">→</span>
								<span className="truncate">{accountName(r.accountId)}</span>
							</div>
							<Button
								size="icon"
								variant="ghost"
								onClick={() => handleDelete(r.id)}
								disabled={isPending && deletingId === r.id}
								className="h-8 w-8 shrink-0"
							>
								{isPending && deletingId === r.id ? (
									<Spinner />
								) : (
									<HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
								)}
							</Button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
