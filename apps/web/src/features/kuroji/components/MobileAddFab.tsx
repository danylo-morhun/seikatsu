"use client";

import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { Button } from "@seikatsu/ui";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function MobileAddFab({
	workspaceId,
	baseCurrency,
}: {
	workspaceId: string;
	baseCurrency: string;
}) {
	return (
		<div className="fixed bottom-[68px] right-4 z-50 md:hidden">
			<AddTransactionModal
				workspaceId={workspaceId}
				baseCurrency={baseCurrency}
				trigger={
					<Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
						<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
					</Button>
				}
			/>
		</div>
	);
}
