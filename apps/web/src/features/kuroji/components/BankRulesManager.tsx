"use client";

import { Spinner } from "@/components/Spinner";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import type { getBankRules } from "@/features/kuroji/actions/bank";
import { createBankRule, deleteBankRule } from "@/features/kuroji/actions/bank";
import { AccountPicker } from "@/features/kuroji/components/AccountSelect";
import { ArrowRight02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input } from "@seikatsu/ui";
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
	const [isPending, startTransition] = useTransition();
	const [matchText, setMatchText] = useState("");
	const [accountId, setAccountId] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const categories = accounts.filter((a) => a.type === "INCOME" || a.type === "EXPENSE");
	const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";

	const ready = matchText.trim() !== "" && accountId !== "";

	function handleAdd() {
		if (!ready) return;
		startTransition(async () => {
			const result = await createBankRule(workspaceId, matchText, accountId);
			if ("error" in result) {
				toast.error(result.error);
			} else {
				setMatchText("");
				setAccountId("");
			}
		});
	}

	function handleDelete(id: string) {
		setDeletingId(id);
		startTransition(async () => {
			const result = await deleteBankRule(id);
			if ("error" in result) toast.error(result.error);
			setDeletingId(null);
		});
	}

	return (
		<div className="space-y-4">
			<form
				className="flex flex-col gap-2 sm:flex-row"
				onSubmit={(e) => {
					e.preventDefault();
					handleAdd();
				}}
			>
				<Input
					placeholder="Keyword, e.g. Biedronka"
					aria-label="Keyword"
					value={matchText}
					onChange={(e) => setMatchText(e.target.value)}
					className="sm:flex-1"
				/>
				<AccountPicker
					value={accountId}
					onValueChange={setAccountId}
					accounts={categories}
					placeholder="Category"
					aria-label="Category"
					className="sm:w-56"
				/>
				<Button
					type="submit"
					variant={ready ? "default" : "outline"}
					disabled={isPending || !ready}
					className="gap-1.5"
				>
					{isPending && !deletingId && <Spinner />}
					Add rule
				</Button>
			</form>

			{rules.length > 0 && (
				<div className="divide-y divide-rule border-y border-rule">
					{rules.map((r) => (
						<div key={r.id} className="flex items-center justify-between gap-3 py-1.5">
							<div className="flex min-w-0 items-center gap-2 text-sm">
								<span className="truncate font-medium">{r.matchText}</span>
								<HugeiconsIcon
									icon={ArrowRight02Icon}
									aria-hidden
									className="size-3.5 shrink-0 text-muted-foreground"
								/>
								<span className="sr-only">files under</span>
								<span className="truncate text-muted-foreground">{accountName(r.accountId)}</span>
							</div>
							<Button
								size="icon"
								variant="ghost"
								onClick={() => handleDelete(r.id)}
								disabled={isPending && deletingId === r.id}
								className="size-10 shrink-0 text-muted-foreground hover:text-foreground md:size-8"
								aria-label={`Delete rule ${r.matchText}`}
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
