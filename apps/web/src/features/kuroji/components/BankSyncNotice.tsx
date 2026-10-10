import type { BankProblem } from "@/features/kuroji/lib/bank-health";
import { RefreshCwOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";

export const BANK_SETTINGS_HREF = "/settings/kuroji?section=banks";

/** One quiet line when a bank stopped feeding the ledger. Vermilion only once access expired. */
export function BankSyncNotice({
	problem,
	className,
}: { problem: BankProblem; className?: string }) {
	const expired = problem.kind === "expired";
	return (
		<p
			className={cn(
				"flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground",
				className,
			)}
		>
			<HugeiconsIcon
				icon={RefreshCwOffIcon}
				size={14}
				className={cn("shrink-0", expired && "text-destructive")}
				aria-hidden
			/>
			<span className={cn(expired && "text-destructive")}>{problem.message}</span>
			<span aria-hidden>·</span>
			<Link
				href={BANK_SETTINGS_HREF}
				prefetch
				className="text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
			>
				{expired ? "Reconnect" : "Check sync"}
			</Link>
		</p>
	);
}
