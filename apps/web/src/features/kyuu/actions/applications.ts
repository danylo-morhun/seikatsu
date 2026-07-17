"use server";

import { auth } from "@/auth";
import {
	and,
	db,
	desc,
	eq,
	isNotNull,
	isNull,
	kyuuApplications,
	type kyuuStatusEnum,
	workspaces,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { applicationSchema } from "../lib/kyuu-schemas";

type KyuuStatus = (typeof kyuuStatusEnum.enumValues)[number];

async function assertWorkspaceOwner(workspaceId: string, userId: string) {
	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);
	if (!ws || ws.userId !== userId) throw new Error("Forbidden");
}

export async function getApplications(
	workspaceId: string,
	opts?: { status?: KyuuStatus; source?: string },
) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	await assertWorkspaceOwner(workspaceId, session.user.id);

	const filters = [
		eq(kyuuApplications.workspaceId, workspaceId),
		isNull(kyuuApplications.archivedAt),
	];
	if (opts?.status) filters.push(eq(kyuuApplications.status, opts.status));
	if (opts?.source) filters.push(eq(kyuuApplications.source, opts.source));

	return db
		.select()
		.from(kyuuApplications)
		.where(and(...filters))
		.orderBy(desc(kyuuApplications.dateApplied));
}

export async function getSources(workspaceId: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	await assertWorkspaceOwner(workspaceId, session.user.id);

	const rows = await db
		.selectDistinct({ source: kyuuApplications.source })
		.from(kyuuApplications)
		.where(and(eq(kyuuApplications.workspaceId, workspaceId), isNotNull(kyuuApplications.source)));

	return rows.map((r) => r.source).filter((s): s is string => !!s);
}

export async function createApplication(workspaceId: string, data: unknown) {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	await assertWorkspaceOwner(workspaceId, session.user.id);

	const parsed = applicationSchema.safeParse(data);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

	const now = new Date();
	const [application] = await db
		.insert(kyuuApplications)
		.values({
			workspaceId,
			company: parsed.data.company,
			role: parsed.data.role,
			jobUrl: parsed.data.jobUrl || null,
			source: parsed.data.source || null,
			status: parsed.data.status,
			hrScreening: parsed.data.hrScreening,
			technicalInterview: parsed.data.technicalInterview,
			offer: parsed.data.offer,
			dateApplied: parsed.data.dateApplied,
			notes: parsed.data.notes || null,
			hrScreeningAt: parsed.data.hrScreening ? now : null,
			technicalInterviewAt: parsed.data.technicalInterview ? now : null,
			offerAt: parsed.data.offer ? now : null,
			rejectedAt: parsed.data.status === "rejected" ? now : null,
		})
		.returning();

	revalidatePath("/kyuu");
	return { success: true as const, data: application };
}

export async function updateApplication(applicationId: string, data: unknown) {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [existing] = await db
		.select({
			workspaceId: kyuuApplications.workspaceId,
			hrScreening: kyuuApplications.hrScreening,
			technicalInterview: kyuuApplications.technicalInterview,
			offer: kyuuApplications.offer,
			status: kyuuApplications.status,
			hrScreeningAt: kyuuApplications.hrScreeningAt,
			technicalInterviewAt: kyuuApplications.technicalInterviewAt,
			offerAt: kyuuApplications.offerAt,
			rejectedAt: kyuuApplications.rejectedAt,
		})
		.from(kyuuApplications)
		.where(eq(kyuuApplications.id, applicationId))
		.limit(1);
	if (!existing) return { error: "Application not found" };
	await assertWorkspaceOwner(existing.workspaceId, session.user.id);

	const parsed = applicationSchema.safeParse(data);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

	const now = new Date();
	// First false→true transition stamps the stage timestamp; later toggles don't overwrite it.
	const hrScreeningAt =
		parsed.data.hrScreening && !existing.hrScreening ? now : existing.hrScreeningAt;
	const technicalInterviewAt =
		parsed.data.technicalInterview && !existing.technicalInterview
			? now
			: existing.technicalInterviewAt;
	const offerAt = parsed.data.offer && !existing.offer ? now : existing.offerAt;
	const rejectedAt =
		parsed.data.status === "rejected" && existing.status !== "rejected" ? now : existing.rejectedAt;

	const [application] = await db
		.update(kyuuApplications)
		.set({
			company: parsed.data.company,
			role: parsed.data.role,
			jobUrl: parsed.data.jobUrl || null,
			source: parsed.data.source || null,
			status: parsed.data.status,
			hrScreening: parsed.data.hrScreening,
			technicalInterview: parsed.data.technicalInterview,
			offer: parsed.data.offer,
			dateApplied: parsed.data.dateApplied,
			notes: parsed.data.notes || null,
			hrScreeningAt,
			technicalInterviewAt,
			offerAt,
			rejectedAt,
			updatedAt: now,
		})
		.where(eq(kyuuApplications.id, applicationId))
		.returning();

	revalidatePath("/kyuu");
	return { success: true as const, data: application };
}

export async function deleteApplication(
	applicationId: string,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [existing] = await db
		.select({ workspaceId: kyuuApplications.workspaceId })
		.from(kyuuApplications)
		.where(eq(kyuuApplications.id, applicationId))
		.limit(1);
	if (!existing) return { error: "Application not found" };
	await assertWorkspaceOwner(existing.workspaceId, session.user.id);

	await db.delete(kyuuApplications).where(eq(kyuuApplications.id, applicationId));
	revalidatePath("/kyuu");
	return { success: true };
}
