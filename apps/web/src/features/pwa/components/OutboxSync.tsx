"use client";

import type { OpResult } from "@/features/pwa/lib/ops";
import { OUTBOX_EVENT, getOps, loadOutbox, removeOp, updateOp } from "@/features/pwa/lib/outbox";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

type Outcome = "done" | "stop";

/** Sends one op; "stop" means try the queue later (offline, signed out, server busy). */
async function send(opId: string, name: string, args: unknown): Promise<Outcome> {
	let res: Response;
	try {
		res = await fetch("/api/outbox", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ opId, name, args }),
		});
	} catch {
		return "stop";
	}
	if (!res.ok) return "stop";
	const { result } = (await res.json()) as { result: OpResult };
	if ("error" in result) await updateOp(opId, { status: "failed", error: result.error });
	else await updateOp(opId, { status: "synced" });
	return "done";
}

/**
 * Replays changes queued offline, in order: on load, when the connection returns and when the
 * app comes back to the foreground (iOS has no background sync). A refused change is marked
 * failed and the rest go on. Once the queue is through, one refresh brings the server's view;
 * synced changes leave the overlay only after it lands, so nothing flickers back.
 */
export function OutboxSync() {
	const router = useRouter();
	const [refreshing, startRefresh] = useTransition();
	const draining = useRef(false);
	const again = useRef(false);
	const awaitingRefresh = useRef(false);

	useEffect(() => {
		async function drain() {
			if (!navigator.onLine) return;
			// A change queued mid-drain gets its own pass once this one ends.
			if (draining.current) {
				again.current = true;
				return;
			}
			draining.current = true;
			try {
				await loadOutbox();
				let sent = 0;
				for (const op of getOps().filter((o) => o.status === "pending")) {
					if ((await send(op.opId, op.name, op.args)) === "stop") break;
					sent++;
				}
				if (sent > 0) {
					awaitingRefresh.current = true;
					startRefresh(() => router.refresh());
				}
			} finally {
				draining.current = false;
			}
			if (again.current) {
				again.current = false;
				drain();
			}
		}

		const onVisible = () => document.visibilityState === "visible" && drain();
		drain();
		window.addEventListener("online", drain);
		window.addEventListener(OUTBOX_EVENT, drain);
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			window.removeEventListener("online", drain);
			window.removeEventListener(OUTBOX_EVENT, drain);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [router]);

	useEffect(() => {
		if (refreshing || !awaitingRefresh.current) return;
		awaitingRefresh.current = false;
		for (const op of getOps()) if (op.status === "synced") removeOp(op.opId);
	}, [refreshing]);

	return null;
}
