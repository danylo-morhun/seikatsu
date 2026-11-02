"use client";

import { PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useState } from "react";
import type { getAccounts } from "@/features/kuroji/actions/data";
import { EditAccountModal } from "@/features/kuroji/components/EditAccountModal";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];

interface Props {
	account: Account;
	workspaceId: string;
}

export function AccountEditButton({ account, workspaceId }: Props) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button variant="outline" onClick={() => setOpen(true)}>
				<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
				Edit
			</Button>
			<EditAccountModal
				account={account}
				workspaceId={workspaceId}
				open={open}
				onOpenChange={setOpen}
			/>
		</>
	);
}
