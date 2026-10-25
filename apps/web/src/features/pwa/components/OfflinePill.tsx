"use client";

import { useOnline } from "@/features/pwa/lib/use-online";
import { WifiDisconnected01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

/** A quiet header note while the device is offline; pages shown come from the offline cache. */
export function OfflinePill() {
	const online = useOnline();
	if (online) return null;

	return (
		<span
			role="status"
			title="Showing saved pages until the connection is back"
			className="flex h-7 animate-rise items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-muted-foreground"
		>
			<HugeiconsIcon icon={WifiDisconnected01Icon} className="size-3.5" />
			Offline
		</span>
	);
}
