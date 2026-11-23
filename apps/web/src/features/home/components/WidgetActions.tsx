"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useState } from "react";
import { LazyAddTransactionModal } from "@/features/kuroji/components/LazyAddTransactionModal";
import type { Workspace } from "@/lib/session";

/** Kuroji's widget: its own expense form, as the app opens it. */
export function AddExpense({ ws }: { ws: Pick<Workspace, "id" | "baseCurrency"> }) {
	const [opened, setOpened] = useState(false);
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				variant="outline"
				size="sm"
				className="gap-1"
				onPointerEnter={() => setOpened(true)}
				onClick={() => {
					setOpened(true);
					setOpen(true);
				}}
			>
				<HugeiconsIcon icon={Add01Icon} className="size-3.5" />
				Expense
			</Button>
			{opened && (
				<LazyAddTransactionModal
					workspaceId={ws.id}
					baseCurrency={ws.baseCurrency}
					open={open}
					onOpenChange={setOpen}
				/>
			)}
		</>
	);
}
