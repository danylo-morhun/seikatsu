"use client";

import { type PushDevice, removeDevice } from "@/features/pwa/actions/push";
import { currentSubscription } from "@/features/pwa/lib/push-client";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

/** "iPhone · Safari" from a user agent — enough to tell devices apart. */
function deviceName(ua: string | null): string {
	if (!ua) return "Unknown device";
	const os = /iPhone/.test(ua)
		? "iPhone"
		: /iPad/.test(ua)
			? "iPad"
			: /Android/.test(ua)
				? "Android"
				: /Mac OS X/.test(ua)
					? "Mac"
					: /Windows/.test(ua)
						? "Windows"
						: /Linux/.test(ua)
							? "Linux"
							: "Device";
	const browser = /Edg\//.test(ua)
		? "Edge"
		: /Firefox\//.test(ua)
			? "Firefox"
			: /Chrome\//.test(ua)
				? "Chrome"
				: /Safari\//.test(ua)
					? "Safari"
					: null;
	return browser ? `${os} · ${browser}` : os;
}

/** Every device that receives push; the current one is marked. */
export function DeviceList({ devices }: { devices: PushDevice[] }) {
	const [mine, setMine] = useState<string | null>(null);
	const [shown, removeShown] = useOptimistic(devices, (list, id: string) =>
		list.filter((d) => d.id !== id),
	);
	const [, startTransition] = useTransition();

	useEffect(() => {
		currentSubscription()
			.then((sub) => setMine(sub?.endpoint ?? null))
			.catch(() => undefined);
	}, []);

	if (shown.length === 0) {
		return (
			<p className="py-4 text-sm text-muted-foreground">
				None yet. Turn notifications on above, on each phone or computer you want them on.
			</p>
		);
	}

	return (
		<ul className="inset-group rounded-2xl bg-surface px-4 py-2 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent">
			{shown.map((device) => (
				<li key={device.id} className="flex items-center gap-3 py-2.5">
					<div className="min-w-0 flex-1">
						<p className="text-sm">
							{deviceName(device.userAgent)}
							{device.endpoint === mine && (
								<span className="ml-2 text-xs text-muted-foreground">this device</span>
							)}
						</p>
						<p className="text-xs text-muted-foreground">
							{device.lastSuccessAt
								? `Last delivered ${formatDistanceToNow(device.lastSuccessAt, { addSuffix: true })}`
								: `Added ${formatDistanceToNow(device.createdAt, { addSuffix: true })}`}
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						aria-label={`Remove ${deviceName(device.userAgent)}`}
						className="shrink-0 text-muted-foreground hover:text-foreground"
						onClick={() =>
							startTransition(async () => {
								removeShown(device.id);
								const result = await removeDevice(device.id).catch(() => ({
									error: "Couldn't remove. Check your connection.",
								}));
								if ("error" in result) toast.error(result.error);
							})
						}
					>
						<HugeiconsIcon icon={Delete02Icon} className="size-4" />
					</Button>
				</li>
			))}
		</ul>
	);
}
