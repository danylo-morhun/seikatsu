"use client";

import { OUTBOX_EVENT, removeOp, updateOp } from "@/features/pwa/lib/outbox";
import { useOnline } from "@/features/pwa/lib/use-online";
import { useOutbox } from "@/features/pwa/lib/use-outbox";
import { Alert02Icon, WifiDisconnected01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Popover, PopoverContent, PopoverTrigger, cn } from "@seikatsu/ui";

const PILL = "flex h-7 animate-rise items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs";

/**
 * The header's connection note: offline (with how many changes wait on this device), syncing,
 * or changes the server refused — those open a list to retry or drop.
 */
export function OfflinePill() {
	const online = useOnline();
	const ops = useOutbox();
	const pending = ops.filter((o) => o.status === "pending").length;
	const failed = ops.filter((o) => o.status === "failed");

	if (failed.length > 0) {
		return (
			<Popover>
				<PopoverTrigger asChild>
					<button type="button" className={PILL}>
						<HugeiconsIcon icon={Alert02Icon} className="size-3.5 text-negative" />
						{failed.length} not synced
					</button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-80 p-0">
					<p className="border-b border-rule px-3 py-2 text-xs text-muted-foreground">
						Made offline, refused when sent. Retry, or drop them.
					</p>
					<ul className="max-h-72 divide-y divide-rule overflow-y-auto">
						{failed.map((op) => (
							<li key={op.opId} className="flex items-start gap-2 px-3 py-2">
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm">{op.label}</p>
									<p className="text-xs text-muted-foreground">{op.error}</p>
								</div>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										updateOp(op.opId, { status: "pending", error: undefined });
										window.dispatchEvent(new Event(OUTBOX_EVENT));
									}}
								>
									Retry
								</Button>
								<Button size="sm" variant="ghost" onClick={() => removeOp(op.opId)}>
									Drop
								</Button>
							</li>
						))}
					</ul>
				</PopoverContent>
			</Popover>
		);
	}

	if (!online) {
		return (
			<span
				role="status"
				title="Showing saved pages; changes sync when the connection is back"
				className={cn(PILL, "text-muted-foreground")}
			>
				<HugeiconsIcon icon={WifiDisconnected01Icon} className="size-3.5" />
				Offline
				{pending > 0 && <span className="font-figures">· {pending}</span>}
			</span>
		);
	}

	if (pending > 0) {
		return (
			<span role="status" className={cn(PILL, "text-muted-foreground")}>
				Syncing <span className="font-figures">{pending}</span>…
			</span>
		);
	}

	return null;
}
