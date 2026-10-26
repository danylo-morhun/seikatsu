import type { Op, OpName } from "@/features/pwa/lib/ops";
import { getOps, getServerOps, subscribeOutbox } from "@/features/pwa/lib/outbox";
import { useMemo, useSyncExternalStore } from "react";

/** Every queued op, oldest first. Empty on the server and before IndexedDB loads. */
export function useOutbox(): Op[] {
	return useSyncExternalStore(subscribeOutbox, getOps, getServerOps);
}

/** Queued or just-synced (not failed) ops whose name starts with `prefix`, e.g. "keizoku." — to overlay on server data. */
export function usePendingOps(prefix: string): Op<OpName>[] {
	const ops = useOutbox();
	return useMemo(
		() => ops.filter((o) => o.status !== "failed" && o.name.startsWith(prefix)),
		[ops, prefix],
	);
}
