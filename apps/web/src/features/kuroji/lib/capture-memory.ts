// What this browser last used in the transaction form, so the next capture starts there.
// Per workspace, in localStorage: a convenience, never a source of truth — every read is
// checked against the accounts that still exist.

type Side = "expense" | "income";

type Memory = {
	wallet?: Partial<Record<Side, string>>;
	transfer?: { from?: string; to?: string };
	recent?: Partial<Record<Side, string[]>>;
};

const RECENT_MAX = 5;

function key(workspaceId: string) {
	return `kuroji:capture:${workspaceId}`;
}

export function readCaptureMemory(workspaceId: string): Memory {
	try {
		return JSON.parse(localStorage.getItem(key(workspaceId)) ?? "{}") as Memory;
	} catch {
		return {};
	}
}

function write(workspaceId: string, next: Memory) {
	try {
		localStorage.setItem(key(workspaceId), JSON.stringify(next));
	} catch {
		// Private mode or full storage: the form simply starts blank next time.
	}
}

export function rememberCapture(
	workspaceId: string,
	entry:
		| { type: Side; walletId: string; categoryIds: string[] }
		| { type: "transfer"; fromId: string; toId: string },
) {
	const mem = readCaptureMemory(workspaceId);
	if (entry.type === "transfer") {
		write(workspaceId, { ...mem, transfer: { from: entry.fromId, to: entry.toId } });
		return;
	}
	const recent = [
		...entry.categoryIds,
		...(mem.recent?.[entry.type] ?? []).filter((id) => !entry.categoryIds.includes(id)),
	].slice(0, RECENT_MAX);
	write(workspaceId, {
		...mem,
		wallet: { ...mem.wallet, [entry.type]: entry.walletId },
		recent: { ...mem.recent, [entry.type]: recent },
	});
}
