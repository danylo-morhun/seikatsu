"use server";

import { auth } from "@/auth";
import {
	and,
	db,
	eq,
	inArray,
	tags,
	transactionTags,
	transactions,
	workspaces,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type Tag = { id: string; name: string; color: string | null };

export async function getTags(workspaceId: string): Promise<Tag[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) throw new Error("Forbidden");

	return db
		.select({ id: tags.id, name: tags.name, color: tags.color })
		.from(tags)
		.where(eq(tags.workspaceId, workspaceId));
}

export async function createTag(
	workspaceId: string,
	name: string,
	color?: string,
): Promise<{ error: string } | { success: true; tag: Tag }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };

	try {
		const [tag] = await db
			.insert(tags)
			.values({ workspaceId, name: name.trim(), color: color ?? null })
			.returning({ id: tags.id, name: tags.name, color: tags.color });
		revalidatePath("/kuroji");
		return { success: true, tag };
	} catch {
		return { error: "Tag name already exists" };
	}
}

export async function deleteTag(tagId: string): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [tag] = await db
		.select({ workspaceId: tags.workspaceId })
		.from(tags)
		.where(eq(tags.id, tagId))
		.limit(1);

	if (!tag) return { error: "Tag not found" };

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, tag.workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };

	await db.delete(tags).where(eq(tags.id, tagId));
	revalidatePath("/kuroji");
	return { success: true };
}

export async function setTransactionTags(
	transactionId: string,
	tagIds: string[],
	workspaceId: string,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };

	const [txnRow] = await db
		.select({ workspaceId: transactions.workspaceId })
		.from(transactions)
		.where(eq(transactions.id, transactionId))
		.limit(1);

	if (!txnRow || txnRow.workspaceId !== workspaceId) return { error: "Transaction not found" };

	if (tagIds.length > 0) {
		const valid = await db
			.select({ id: tags.id })
			.from(tags)
			.where(and(inArray(tags.id, tagIds), eq(tags.workspaceId, workspaceId)));
		if (valid.length !== tagIds.length) return { error: "Tag not found" };
	}

	await db.transaction(async (tx) => {
		await tx.delete(transactionTags).where(eq(transactionTags.transactionId, transactionId));
		if (tagIds.length > 0) {
			await tx.insert(transactionTags).values(tagIds.map((tagId) => ({ transactionId, tagId })));
		}
	});

	revalidatePath("/kuroji");
	return { success: true };
}
