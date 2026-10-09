type Node = { id: string; parentId: string | null };

/**
 * Why `parentId` can't hold `accountId`, or null if it can. `accounts` is the account's
 * workspace: a parent outside it is not found, and the account itself or one of its
 * sub-accounts would make a loop.
 */
export function parentError(accountId: string, parentId: string, accounts: Node[]): string | null {
	const byId = new Map(accounts.map((a) => [a.id, a]));
	if (!byId.has(parentId)) return "Parent account not found";

	// Walk up from the new parent: meeting the account means it would sit under itself.
	const seen = new Set<string>();
	for (let id: string | null = parentId; id && !seen.has(id); id = byId.get(id)?.parentId ?? null) {
		if (id === accountId) return "An account can't sit under itself or its sub-accounts";
		seen.add(id);
	}
	return null;
}
