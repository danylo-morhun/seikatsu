"use server";

import { getOwnedVehicle } from "@/features/aisha/actions/guard";
import { type DocumentFormValues, documentFormSchema } from "@/features/aisha/lib/aisha-schemas";
import { aishaDocuments, db, eq } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

async function getOwnedDocument(documentId: string) {
	const [doc] = await db
		.select()
		.from(aishaDocuments)
		.where(eq(aishaDocuments.id, documentId))
		.limit(1);
	if (!doc || !(await getOwnedVehicle(doc.vehicleId))) return null;
	return doc;
}

export async function createDocument(
	vehicleId: string,
	values: DocumentFormValues,
): Promise<{ error: string } | { success: true }> {
	if (!(await getOwnedVehicle(vehicleId))) return { error: "Vehicle not found" };

	const parsed = documentFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db.insert(aishaDocuments).values({ vehicleId, ...parsed.data });
	revalidatePath("/aisha");
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
	revalidatePath("/aisha");
	return { success: true };
}

export async function deleteDocument(
	documentId: string,
): Promise<{ error: string } | { success: true }> {
	if (!(await getOwnedDocument(documentId))) return { error: "Document not found" };
	await db.delete(aishaDocuments).where(eq(aishaDocuments.id, documentId));
	revalidatePath("/aisha");
	return { success: true };
}
