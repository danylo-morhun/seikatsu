// Reads for Settings → Account → Claude. Plain module; the page passes its own workspace.

import { and, db, desc, eq, inArray, isNull, mcpCalls, mcpGrants } from "@seikatsu/db";

export type GrantRow = {
	id: string;
	name: string;
	personal: boolean;
	write: boolean;
	createdAt: string;
	lastUsedAt: string | null;
};

export type WriteRow = { id: string; tool: string; grant: string; ok: boolean; at: string };

export async function getClaudeAccess(
	workspaceId: string,
): Promise<{ grants: GrantRow[]; writes: WriteRow[] }> {
	const grants = await db
		.select()
		.from(mcpGrants)
		.where(and(eq(mcpGrants.workspaceId, workspaceId), isNull(mcpGrants.revokedAt)))
		.orderBy(desc(mcpGrants.createdAt));
	const names = new Map(grants.map((g) => [g.id, g.name]));
	const writes =
		grants.length === 0
			? []
			: await db
					.select()
					.from(mcpCalls)
					.where(and(inArray(mcpCalls.grantId, [...names.keys()]), eq(mcpCalls.write, true)))
					.orderBy(desc(mcpCalls.createdAt))
					.limit(50);
	return {
		grants: grants.map((g) => ({
			id: g.id,
			name: g.name,
			personal: g.clientId === null,
			write: g.scopes.includes("write"),
			createdAt: g.createdAt.toISOString(),
			lastUsedAt: g.lastUsedAt?.toISOString() ?? null,
		})),
		writes: writes.map((w) => ({
			id: w.id,
			tool: w.tool,
			grant: names.get(w.grantId) ?? "",
			ok: w.ok,
			at: w.createdAt.toISOString(),
		})),
	};
}
