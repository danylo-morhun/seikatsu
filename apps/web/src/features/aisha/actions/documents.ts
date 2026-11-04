"use server";

import { aishaDocuments, aishaVehicles, and, db, eq } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { getOwnedVehicle, isUuid } from "@/features/aisha/actions/guard";
import { type DocumentFormValues, documentFormSchema } from "@/features/aisha/lib/aisha-schemas";
import { revalidateShell } from "@/lib/revalidate";
import { getCurrentWorkspace } from "@/lib/session";

async function getOwnedDocument(documentId: string) {
	if (!isUuid(documentId)) return null;
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [row] = await db
		.select({ doc: aishaDocuments })
		.from(aishaDocuments)
		.innerJoin(aishaVehicles, eq(aishaVehicles.id, aishaDocuments.vehicleId))
		.where(and(eq(aishaDocuments.id, documentId), eq(aishaVehicles.workspaceId, ws.id)))
		.limit(1);
	return row?.doc ?? null;
}

export async function createDocument(
	vehicleId: string,
	values: DocumentFormValues,
): Promise<{ error: string } | { success: true }> {
	if (!(await getOwnedVehicle(vehicleId))) return { error: "Vehicle not found" };

	const parsed = documentFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db.insert(aishaDocuments).values({ vehicleId, ...parsed.data });
	revalidatePath("/aisha", "layout");
	revalidateShell();
	return { success: true };
}

export async function updateDocument(
	documentId: string,
	values: DocumentFormValues,
): Promise<{ error: string } | { success: true }> {
	if (!(await getOwnedDocument(documentId))) return { error: "Document not found" };

	const parsed = documentFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db
		.update(aishaDocuments)
		.set({ ...parsed.data, note: parsed.data.note ?? null })
		.where(eq(aishaDocuments.id, documentId));
	revalidatePath("/aisha", "layout");
	revalidateShell();
	return { success: true };
}

export async function deleteDocument(
	documentId: string,
): Promise<{ error: string } | { success: true }> {
	if (!(await getOwnedDocument(documentId))) return { error: "Document not found" };
	await db.delete(aishaDocuments).where(eq(aishaDocuments.id, documentId));
	revalidatePath("/aisha", "layout");
	revalidateShell();
	return { success: true };
}
