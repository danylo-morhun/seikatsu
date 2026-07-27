"use server";

import { auth } from "@/auth";
import { and, asc, db, desc, eq, isNotNull, kyuuApplications, workspaces } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { type KyuuStatus, applicationSchema, kyuuStatusValues } from "../lib/kyuu-schemas";
import { type KyuuFilters, buildKyuuConditions } from "./filters";

async function assertWorkspaceOwner(workspaceId: string, userId: string) {
	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);
	if (!ws || ws.userId !== userId) throw new Error("Forbidden");
}

const SORT_COLUMNS = {
	date: kyuuApplications.dateApplied,
	company: kyuuApplications.company,
	status: kyuuApplications.status,
} as const;

export async function getApplications(
	workspaceId: string,
	opts?: KyuuFilters & { sort?: keyof typeof SORT_COLUMNS; dir?: "asc" | "desc" },
) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	await assertWorkspaceOwner(workspaceId, session.user.id);

	const where = buildKyuuConditions(workspaceId, opts ?? {});
	const sortCol = SORT_COLUMNS[opts?.sort ?? "date"];
	const orderFn = opts?.dir === "asc" ? asc : desc;

	return db.select().from(kyuuApplications).where(where).orderBy(orderFn(sortCol));
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

export interface ResumeFile {
	fileUrl: string;
	fileName: string;
}

export async function getResumeFiles(workspaceId: string): Promise<ResumeFile[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	await assertWorkspaceOwner(workspaceId, session.user.id);

	const rows = await db
		.selectDistinct({
			fileUrl: kyuuApplications.resumeFileUrl,
			fileName: kyuuApplications.resumeFileName,
		})
		.from(kyuuApplications)
		.where(
			and(eq(kyuuApplications.workspaceId, workspaceId), isNotNull(kyuuApplications.resumeFileUrl)),
		);

	return rows.filter((r): r is ResumeFile => !!r.fileUrl && !!r.fileName);
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
			resumeFileUrl: parsed.data.resumeFileUrl || null,
			resumeFileName: parsed.data.resumeFileName || null,
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
			resumeFileUrl: parsed.data.resumeFileUrl || null,
			resumeFileName: parsed.data.resumeFileName || null,
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

export async function updateApplicationStatus(applicationId: string, status: unknown) {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [existing] = await db
		.select({
			workspaceId: kyuuApplications.workspaceId,
			status: kyuuApplications.status,
			rejectedAt: kyuuApplications.rejectedAt,
		})
		.from(kyuuApplications)
		.where(eq(kyuuApplications.id, applicationId))
		.limit(1);
	if (!existing) return { error: "Application not found" };
	await assertWorkspaceOwner(existing.workspaceId, session.user.id);

	if (typeof status !== "string" || !(kyuuStatusValues as readonly string[]).includes(status)) {
		return { error: "Invalid status" };
	}

	const newStatus = status as KyuuStatus;
	const now = new Date();
	const rejectedAt =
		newStatus === "rejected" && existing.status !== "rejected" ? now : existing.rejectedAt;

	const [application] = await db
		.update(kyuuApplications)
		.set({
			status: newStatus,
			rejectedAt,
			updatedAt: now,
		})
		.where(eq(kyuuApplications.id, applicationId))
		.returning();

	revalidatePath("/kyuu");
	return { success: true as const, data: application };
}

export type StageField = "hrScreening" | "technicalInterview" | "offer";

export async function updateApplicationStage(
	applicationId: string,
	stage: StageField,
	value: boolean,
) {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [existing] = await db
		.select({
			workspaceId: kyuuApplications.workspaceId,
			hrScreening: kyuuApplications.hrScreening,
			technicalInterview: kyuuApplications.technicalInterview,
			offer: kyuuApplications.offer,
			hrScreeningAt: kyuuApplications.hrScreeningAt,
			technicalInterviewAt: kyuuApplications.technicalInterviewAt,
			offerAt: kyuuApplications.offerAt,
		})
		.from(kyuuApplications)
		.where(eq(kyuuApplications.id, applicationId))
		.limit(1);
	if (!existing) return { error: "Application not found" };
	await assertWorkspaceOwner(existing.workspaceId, session.user.id);

	const now = new Date();
	const updatePayload: Record<string, unknown> = {
		[stage]: value,
		updatedAt: now,
	};

	if (stage === "hrScreening" && value && !existing.hrScreeningAt) {
		updatePayload.hrScreeningAt = now;
	} else if (stage === "technicalInterview" && value && !existing.technicalInterviewAt) {
		updatePayload.technicalInterviewAt = now;
	} else if (stage === "offer" && value && !existing.offerAt) {
		updatePayload.offerAt = now;
	}

	const [application] = await db
		.update(kyuuApplications)
		.set(updatePayload)
		.where(eq(kyuuApplications.id, applicationId))
		.returning();

	revalidatePath("/kyuu");
	return { success: true as const, data: application };
}
