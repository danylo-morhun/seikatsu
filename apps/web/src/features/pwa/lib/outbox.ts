// The browser's queue of changes made offline: IndexedDB (survives reloads and app restarts),
// mirrored in memory for React (useSyncExternalStore). Other tabs hear about changes over a
// BroadcastChannel. Every call tolerates IndexedDB being unavailable (private modes).

import type { OfflineOps, Op, OpName } from "@/features/pwa/lib/ops";

const DB_NAME = "seikatsu-outbox";
const STORE = "ops";
const CHANNEL = "seikatsu-outbox";
/** Fired on window when a change is queued (OutboxSync tries to send it). */
export const OUTBOX_EVENT = "seikatsu:outbox";

let ops: Op[] = [];
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "opId" });
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function tx<T>(
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => IDBRequest<T> | undefined,
): Promise<T | undefined> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const t = db.transaction(STORE, mode);
		const req = work(t.objectStore(STORE));
		t.oncomplete = () => {
			db.close();
			resolve(req?.result);
		};
		t.onerror = () => {
			db.close();
			reject(t.error);
		};
	});
}

function emit(broadcast = true) {
	for (const l of listeners) l();
	if (broadcast) channel?.postMessage("changed");
}

async function reload() {
	try {
		const all = ((await tx("readonly", (s) => s.getAll())) as Op[] | undefined) ?? [];
		ops = all.sort((a, b) => a.createdAt - b.createdAt);
	} catch {
		ops = [];
	}
}

/** Loads the queue once per page; later calls wait for the same load. */
export function loadOutbox(): Promise<void> {
	if (typeof indexedDB === "undefined") return Promise.resolve();
	if (!channel && typeof BroadcastChannel !== "undefined") {
		channel = new BroadcastChannel(CHANNEL);
		channel.onmessage = () => reload().then(() => emit(false));
	}
	loaded ??= reload().then(() => emit(false));
	return loaded;
}

export function subscribeOutbox(listener: () => void) {
	listeners.add(listener);
	loadOutbox();
	return () => listeners.delete(listener);
}

export function getOps(): Op[] {
	return ops;
}

const EMPTY: Op[] = [];
export const getServerOps = () => EMPTY;

export async function enqueue<N extends OpName>(
	name: N,
	args: OfflineOps[N],
	label: string,
): Promise<Op<N>> {
	await loadOutbox();
	const op: Op<N> = {
		opId: crypto.randomUUID(),
		name,
		args,
		label,
		createdAt: Date.now(),
		status: "pending",
	};
	// Stored first: the app can be swiped away a moment after the tap. The screen already
	// shows the change (each view's optimistic state), so this adds no visible delay.
	try {
		await tx("readwrite", (s) => s.put(op));
	} catch {
		// No IndexedDB: the change lives until the page closes — better than dropping it now.
	}
	ops = [...ops, op];
	emit();
	// Queued after a failed send while still "online", or just as the connection came back:
	// nudge the sync rather than wait for the next online/foreground event.
	window.dispatchEvent(new Event(OUTBOX_EVENT));
	return op;
}

export async function updateOp(opId: string, patch: Partial<Pick<Op, "status" | "error">>) {
	const current = ops.find((o) => o.opId === opId);
	if (!current) return;
	const next = { ...current, ...patch };
	ops = ops.map((o) => (o.opId === opId ? next : o));
	emit();
	try {
		await tx("readwrite", (s) => s.put(next));
	} catch {
		// in memory only
	}
}

export async function removeOp(opId: string) {
	ops = ops.filter((o) => o.opId !== opId);
	emit();
	try {
		await tx("readwrite", (s) => s.delete(opId));
	} catch {
		// in memory only
	}
}

/** Signed out: queued changes belonged to that user. */
export async function clearOutbox() {
	ops = [];
	emit();
	try {
		await tx("readwrite", (s) => s.clear());
	} catch {
		// nothing stored
	}
}
