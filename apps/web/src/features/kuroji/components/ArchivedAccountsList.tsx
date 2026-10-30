"use client";

import { SettingsSection } from "@/components/SettingsSection";
import { unarchiveAccount } from "@/features/kuroji/actions/accounts";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import { Archive01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];

export function ArchivedAccountsList({ accounts }: { accounts: Account[] }) {
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
				toast.success(`“${name}” restored`);
			}
			setLoadingId(null);
		});
	}

	return (
		<SettingsSection
			title="Archived"
			description="Off the overview and out of totals; their transactions stay."
			meta={accounts.length}
		>
			<div className="inset-group rounded-2xl bg-surface px-4 py-1 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent">
				{accounts.map((a) => (
					<div key={a.id} className="flex items-center justify-between gap-3 py-1.5">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<HugeiconsIcon icon={Archive01Icon} className="h-4 w-4 shrink-0" />
							<span className="truncate text-foreground">{a.name}</span>
							<span className="shrink-0 text-xs">
								{a.type.charAt(0) + a.type.slice(1).toLowerCase()}
							</span>
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
		</SettingsSection>
	);
}
