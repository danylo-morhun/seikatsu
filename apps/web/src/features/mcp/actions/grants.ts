"use server";

import { and, db, eq, mcpGrants } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createPersonalToken, revokeGrant } from "@/features/mcp/lib/oauth";
import { isUuid, requireWorkspace } from "@/lib/session";

type Result<T = object> = { error: string } | ({ success: true } & T);

const tokenSchema = z.object({ name: z.string().trim().min(1).max(60), write: z.boolean() });

/** A personal token for Claude Code / scripts. Returned once; only its hash is kept. */
export async function createClaudeToken(input: unknown): Promise<Result<{ token: string }>> {
	const ws = await requireWorkspace();
	const parsed = tokenSchema.safeParse(input);
	if (!parsed.success) return { error: "Name the token" };
	const token = await createPersonalToken(
		ws.id,
		parsed.data.name,
		parsed.data.write ? ["read", "write"] : ["read"],
	);
	revalidatePath("/settings/account");
	return { success: true, token };
}

/** Disconnect a client (or a personal token): its tokens stop working at once. */
export async function revokeClaudeAccess(grantId: string): Promise<Result> {
	const ws = await requireWorkspace();
	if (!isUuid(grantId)) return { error: "Not found" };
	const [grant] = await db
		.select({ id: mcpGrants.id })
		.from(mcpGrants)
		.where(and(eq(mcpGrants.id, grantId), eq(mcpGrants.workspaceId, ws.id)))
		.limit(1);
	if (!grant) return { error: "Not found" };
	await revokeGrant(grant.id);
	revalidatePath("/settings/account");
	return { success: true };
}
