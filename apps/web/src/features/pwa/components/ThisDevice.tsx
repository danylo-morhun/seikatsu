"use client";

import { Spinner } from "@/components/Spinner";
import { sendTestNotification, subscribePush, unsubscribePush } from "@/features/pwa/actions/push";
import {
	type PushSupport,
	currentSubscription,
	pushSupport,
	subscribeDevice,
} from "@/features/pwa/lib/push-client";
import { AddSquareIcon, Share08Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

const FAILED = { error: "Couldn't save. Check your connection." };

/** Turns push on or off for the browser this page is open in. */
export function ThisDevice({ configured }: { configured: boolean }) {
	const [support, setSupport] = useState<PushSupport | null>(null);
	const [endpoint, setEndpoint] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const [testing, startTest] = useTransition();

	useEffect(() => {
		setSupport(pushSupport());
		currentSubscription()
			.then((sub) => setEndpoint(sub?.endpoint ?? null))
			.catch(() => undefined);
	}, []);

	function enable() {
		startTransition(async () => {
			try {
				const sub = await subscribeDevice();
				const result = await subscribePush(
					sub.toJSON(),
					Intl.DateTimeFormat().resolvedOptions().timeZone,
					navigator.userAgent,
				).catch(() => FAILED);
				if ("error" in result) {
					await sub.unsubscribe();
					toast.error(result.error);
					return;
				}
				setEndpoint(sub.endpoint);
			} catch (e) {
				setSupport(pushSupport());
				toast.error(e instanceof Error ? e.message : "Couldn't turn on notifications.");
			}
		});
	}

	function disable() {
		startTransition(async () => {
			const sub = await currentSubscription().catch(() => null);
			if (!sub) return setEndpoint(null);
			const result = await unsubscribePush(sub.endpoint).catch(() => FAILED);
			if ("error" in result) return void toast.error(result.error);
			await sub.unsubscribe().catch(() => undefined);
			setEndpoint(null);
		});
	}

	function test() {
		startTest(async () => {
			const result = await sendTestNotification().catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
		});
	}

	if (support === null) return <div className="h-10" />;

	if (!configured) {
		return (
			<p className="text-sm text-muted-foreground">
				Push isn't set up on the server yet (VAPID keys missing).
			</p>
		);
	}

	if (support === "needs-install") {
		return (
			<ol className="space-y-2 text-sm text-muted-foreground">
				<li className="flex items-center gap-2">
					<span className="text-foreground">1.</span> Tap
					<HugeiconsIcon icon={Share08Icon} className="size-4 text-foreground" aria-label="Share" />
					in Safari
				</li>
				<li className="flex items-center gap-2">
					<span className="text-foreground">2.</span> Choose
					<span className="inline-flex items-center gap-1 text-foreground">
						Add to Home Screen
						<HugeiconsIcon icon={AddSquareIcon} className="size-4" />
					</span>
				</li>
				<li>
					<span className="text-foreground">3.</span> Open seikatsu from the Home Screen and come
					back here
				</li>
			</ol>
		);
	}

	if (support === "unsupported") {
		return <p className="text-sm text-muted-foreground">This browser can't receive push.</p>;
	}

	if (support === "denied") {
		return (
			<p className="text-sm text-muted-foreground">
				Notifications are blocked for seikatsu. Allow them in the browser's (or iOS) settings, then
				reload.
			</p>
		);
	}

	if (!endpoint) {
		return (
			<Button onClick={enable} disabled={pending} className="gap-1.5">
				{pending && <Spinner />}
				{pending ? "Turning on…" : "Turn on notifications"}
			</Button>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="mr-2 text-sm">On for this device</span>
			<Button variant="outline" onClick={test} disabled={testing} className="gap-1.5">
				{testing && <Spinner />}
				{testing ? "Sending…" : "Send a test"}
			</Button>
			<Button variant="ghost" onClick={disable} disabled={pending} className="gap-1.5">
				{pending && <Spinner />}
				Turn off
			</Button>
		</div>
	);
}
