"use server";

import { getAccounts } from "@/features/kuroji/actions/accounts";
import { type Tag, getTags } from "@/features/kuroji/actions/tags";

export type FormAccount = Awaited<ReturnType<typeof getAccounts>>[number];
export type FormOptions = { accounts: FormAccount[]; tags: Tag[] };

/** Accounts + tags for the Kuroji forms in one round trip (server actions run serially). */
export async function getFormOptions(workspaceId: string): Promise<FormOptions> {
	const [accounts, tags] = await Promise.all([getAccounts(workspaceId), getTags(workspaceId)]);
	return { accounts, tags };
}
