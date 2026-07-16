"use client";

import { unarchiveAccount } from "@/features/kuroji/actions/accounts";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import { Archive01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];

export function ArchivedAccountsList({ accounts }: { accounts: Account[] }) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [loadingId, setLoadingId] = React.useState<string | null>(null);

	if (accounts.length === 0) return null;

	function handleRestore(id: string, name: string) {
		setLoadingId(id);
		startTransition(async () => {
			const result = await unarchiveAccount(id);
			if ("error" in result) {
				toast.error(result.error);
			} else {
				toast.success(`"${name}" restored`);
				router.refresh();
			}
			setLoadingId(null);
		});
	}

	return (
		<section className="mt-8">
			<h2 className="mb-1 text-base font-semibold">Archived Accounts</h2>
			<p className="mb-4 text-sm text-muted-foreground">
				These accounts are hidden from the dashboard but their history is preserved.
			</p>
			<div className="divide-y rounded-md border">
				{accounts.map((a) => (
					<div key={a.id} className="flex items-center justify-between px-4 py-3">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<HugeiconsIcon icon={Archive01Icon} className="h-4 w-4 shrink-0" />
							<span>{a.name}</span>
							<span className="text-xs">({a.type.charAt(0) + a.type.slice(1).toLowerCase()})</span>
						</div>
						<Button
							size="sm"
							variant="outline"
							disabled={isPending && loadingId === a.id}
							onClick={() => handleRestore(a.id, a.name)}
						>
							{isPending && loadingId === a.id ? "Restoring…" : "Restore"}
						</Button>
					</div>
				))}
			</div>
		</section>
	);
}
