"use server";

import { getCurrentWorkspace, requireWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import {
	and,
	asc,
	count,
	db,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	kyuuApplications,
	kyuuEvents,
} from "@seikatsu/db";
import { toCountryCode } from "../lib/country";
import {
	type ApplicationFormValues,
	type ApplicationPatch,
	type KyuuView,
	applicationPatchSchema,
	applicationSchema,
} from "../lib/kyuu-schemas";
import { APPLICATIONS_PAGE_SIZE, type KyuuFilters, type SortField } from "../lib/search-params";
import { normalizeSource } from "../lib/sources";
import { ANSWER_KINDS, CLOSED, IN_PROGRESS, toStatus, waiting } from "../lib/stages";
import { type KyuuStats, computeStats } from "../lib/stats";
import type { ApplicationDetail, ApplicationRow, KyuuEvent } from "../lib/types";
import { buildKyuuConditions } from "./filters";
import { type Result, getOwnedApplication, revalidateKyuu } from "./guard";

const SORT_COLUMNS = {
	date: kyuuApplications.dateApplied,
	company: kyuuApplications.company,
	status: kyuuApplications.status,
} as const;

// What lists show. The long posting text, cover letter etc. load with the sheet.
const rowColumns = {
	id: kyuuApplications.id,
	company: kyuuApplications.company,
	role: kyuuApplications.role,
	jobUrl: kyuuApplications.jobUrl,
	source: kyuuApplications.source,
	country: kyuuApplications.country,
	status: kyuuApplications.status,
	applyMethod: kyuuApplications.applyMethod,
	dateApplied: kyuuApplications.dateApplied,
	notes: kyuuApplications.notes,
	archivedAt: kyuuApplications.archivedAt,
};

type RawRow = {
	id: string;
	company: string;
	role: string;
	jobUrl: string | null;
	source: string | null;
	country: string | null;
	status: string;
	applyMethod: "manual" | "auto";
	dateApplied: string;
	notes: string | null;
	archivedAt: Date | null;
};

const eventColumns = {
	id: kyuuEvents.id,
	applicationId: kyuuEvents.applicationId,
	kind: kyuuEvents.kind,
	date: kyuuEvents.date,
	time: kyuuEvents.time,
	note: kyuuEvents.note,
	createdAt: kyuuEvents.createdAt,
};

type RawEvent = {
	id: string;
	applicationId: string;
	kind: KyuuEvent["kind"];
	date: string | null;
	time: string | null;
	note: string | null;
	createdAt: Date;
};

const toEvent = (e: RawEvent): KyuuEvent => ({
	id: e.id,
	kind: e.kind,
	date: e.date,
	time: e.time ? e.time.slice(0, 5) : null,
	note: e.note,
});

/** Oldest first; a day-less event sits where it was logged. */
function byWhen(a: RawEvent, b: RawEvent) {
	const ad = a.date ?? a.createdAt.toISOString().slice(0, 10);
	const bd = b.date ?? b.createdAt.toISOString().slice(0, 10);
	if (ad !== bd) return ad < bd ? -1 : 1;
	if ((a.time ?? "") !== (b.time ?? "")) return (a.time ?? "") < (b.time ?? "") ? -1 : 1;
	return a.createdAt.getTime() - b.createdAt.getTime();
}

async function eventsOf(ids: string[]): Promise<Map<string, RawEvent[]>> {
	const map = new Map<string, RawEvent[]>();
	if (ids.length === 0) return map;
	const rows = await db
		.select(eventColumns)
		.from(kyuuEvents)
		.where(inArray(kyuuEvents.applicationId, ids));
	for (const e of rows.sort(byWhen)) {
		const list = map.get(e.applicationId);
		if (list) list.push(e);
		else map.set(e.applicationId, [e]);
	}
	return map;
}

function toRow(r: RawRow, events: RawEvent[], today: string): ApplicationRow {
	const status = toStatus(r.status);
	const next = events.find(
		(e) => (e.kind === "screening" || e.kind === "interview") && e.date != null && e.date >= today,
	);
	const followedUpOn = events.filter((e) => e.kind === "follow_up" && e.date).at(-1)?.date ?? null;
	const answered = events.some((e) => ANSWER_KINDS.includes(e.kind));
	return {
		id: r.id,
		company: r.company,
		role: r.role,
		jobUrl: r.jobUrl,
		source: r.source,
		country: r.country,
		status,
		applyMethod: r.applyMethod,
		dateApplied: r.dateApplied,
		notes: r.notes,
		archived: r.archivedAt != null,
		next: next ? { kind: next.kind, date: next.date, time: next.time?.slice(0, 5) ?? null } : null,
		waiting: r.archivedAt
			? null
			: waiting({ status, dateApplied: r.dateApplied, followedUpOn, answered }, today),
	};
}

async function withProgress(rows: RawRow[]): Promise<ApplicationRow[]> {
	const [events, today] = await Promise.all([eventsOf(rows.map((r) => r.id)), getUserToday()]);
	return rows.map((r) => toRow(r, events.get(r.id) ?? [], today));
}

// ── Reads ──

/** One page of the All table. */
export async function getApplicationsPage(
	filters: KyuuFilters,
	opts: { sort: SortField; dir: "asc" | "desc"; page: number },
): Promise<{ rows: ApplicationRow[]; total: number }> {
	const ws = await requireWorkspace();
	const where = buildKyuuConditions(ws.id, filters);
	const orderFn = opts.dir === "asc" ? asc : desc;
	const [rows, [counted]] = await Promise.all([
		db
			.select(rowColumns)
			.from(kyuuApplications)
			.where(where)
			// Newest first within a day, and id as a tie-breaker keeps rows from jumping pages.
			.orderBy(
				orderFn(SORT_COLUMNS[opts.sort]),
				desc(kyuuApplications.createdAt),
				asc(kyuuApplications.id),
			)
			.limit(APPLICATIONS_PAGE_SIZE)
			.offset(opts.page * APPLICATIONS_PAGE_SIZE),
		db.select({ total: count() }).from(kyuuApplications).where(where),
	]);
	return { rows: await withProgress(rows), total: counted?.total ?? 0 };
}

/** How many applications each view of the table holds. */
export async function getViewCounts(): Promise<Record<KyuuView, number>> {
	const ws = await requireWorkspace();
	const rows = await db
		.select({
			status: kyuuApplications.status,
			archived: isNotNull(kyuuApplications.archivedAt),
			count: count(),
		})
		.from(kyuuApplications)
		.where(eq(kyuuApplications.workspaceId, ws.id))
		.groupBy(kyuuApplications.status, isNotNull(kyuuApplications.archivedAt));
	const counts: Record<KyuuView, number> = {
		all: 0,
		queue: 0,
		waiting: 0,
		active: 0,
		closed: 0,
		archived: 0,
	};
	for (const r of rows) {
		if (r.archived) {
			counts.archived += r.count;
			continue;
		}
		const status = toStatus(r.status);
		counts.all += r.count;
		if (status === "sourced" || status === "drafted") counts.queue += r.count;
		else if (status === "applied") counts.waiting += r.count;
		else if (IN_PROGRESS.includes(status)) counts.active += r.count;
		else if (CLOSED.includes(status)) counts.closed += r.count;
	}
	return counts;
}

/** Sent applications nobody has answered for GHOST_DAYS: the Waiting view closes them at once. */
export async function getGhostDue(): Promise<string[]> {
	const ws = await requireWorkspace();
	const rows = await db
		.select(rowColumns)
		.from(kyuuApplications)
		.where(
			and(
				eq(kyuuApplications.workspaceId, ws.id),
				isNull(kyuuApplications.archivedAt),
				eq(kyuuApplications.status, "applied"),
			),
		);
	return (await withProgress(rows)).filter((r) => r.waiting?.due === "ghost").map((r) => r.id);
}

/** Everything about one application, for its page. */
export async function getApplication(applicationId: string): Promise<Result<ApplicationDetail>> {
	const owned = await getOwnedApplication(applicationId);
	if (!owned) return { error: "Application not found" };
	const [row] = await db
		.select({
			...rowColumns,
			contact: kyuuApplications.contact,
			location: kyuuApplications.location,
			remote: kyuuApplications.remote,
			salary: kyuuApplications.salary,
			fitVerdict: kyuuApplications.fitVerdict,
			stackTags: kyuuApplications.stackTags,
			jobDescription: kyuuApplications.jobDescription,
			coverLetter: kyuuApplications.coverLetter,
			resumeFileUrl: kyuuApplications.resumeFileUrl,
			resumeFileName: kyuuApplications.resumeFileName,
			createdAt: kyuuApplications.createdAt,
		})
		.from(kyuuApplications)
		.where(eq(kyuuApplications.id, owned.id))
		.limit(1);
	if (!row) return { error: "Application not found" };
	const [events, today] = await Promise.all([eventsOf([row.id]), getUserToday()]);
	const list = events.get(row.id) ?? [];
	return {
		success: true,
		data: {
			...toRow(row, list, today),
			contact: row.contact,
			location: row.location,
			remote: row.remote,
			salary: row.salary,
			fitVerdict: row.fitVerdict,
			stackTags: row.stackTags,
			jobDescription: row.jobDescription,
			coverLetter: row.coverLetter,
			resumeFileUrl: row.resumeFileUrl,
			resumeFileName: row.resumeFileName,
			createdAt: row.createdAt.toISOString(),
			events: list.map(toEvent),
		},
	};
}

/** Every source in use, most used first. */
export async function getSources(): Promise<{ source: string; count: number }[]> {
	const ws = await getCurrentWorkspace();
	if (!ws) return [];
	const rows = await db
		.select({ source: kyuuApplications.source, count: count() })
		.from(kyuuApplications)
		.where(and(eq(kyuuApplications.workspaceId, ws.id), isNotNull(kyuuApplications.source)))
		.groupBy(kyuuApplications.source)
		.orderBy(desc(count()));
	return rows.filter((r): r is { source: string; count: number } => !!r.source);
}

/** Résumés already uploaded, to pick one again. */
export async function getResumeFiles(): Promise<{ fileUrl: string; fileName: string }[]> {
	const ws = await getCurrentWorkspace();
	if (!ws) return [];
	const rows = await db
		.selectDistinct({
			fileUrl: kyuuApplications.resumeFileUrl,
			fileName: kyuuApplications.resumeFileName,
		})
		.from(kyuuApplications)
		.where(and(eq(kyuuApplications.workspaceId, ws.id), isNotNull(kyuuApplications.resumeFileUrl)));
	return rows.filter(
		(r): r is { fileUrl: string; fileName: string } => !!r.fileUrl && !!r.fileName,
	);
}

/** The Stats page's numbers, under the same filters as All. */
export async function getStats(filters: KyuuFilters): Promise<KyuuStats> {
	const ws = await requireWorkspace();
	const where = buildKyuuConditions(ws.id, { ...filters, view: "all" });
	const apps = await db
		.select({
			id: kyuuApplications.id,
			status: kyuuApplications.status,
			source: kyuuApplications.source,
			applyMethod: kyuuApplications.applyMethod,
			dateApplied: kyuuApplications.dateApplied,
		})
		.from(kyuuApplications)
		.where(where);
	const events = await db
		.select({
			applicationId: kyuuEvents.applicationId,
			kind: kyuuEvents.kind,
			date: kyuuEvents.date,
		})
		.from(kyuuEvents)
		.innerJoin(kyuuApplications, eq(kyuuApplications.id, kyuuEvents.applicationId))
		.where(where);
	return computeStats(
		apps.map((a) => ({ ...a, status: toStatus(a.status) })),
		events,
		await getUserToday(),
	);
}

// ── Writes ──

function valuesOf(data: ApplicationFormValues) {
	return {
		company: data.company,
		role: data.role,
		jobUrl: data.jobUrl || null,
		source: normalizeSource(data.source),
		status: data.status,
		dateApplied: data.dateApplied,
		contact: data.contact || null,
		salary: data.salary || null,
		location: data.location || null,
		notes: data.notes || null,
		resumeFileUrl: data.resumeFileUrl || null,
		resumeFileName: data.resumeFileName || null,
	};
}

export async function createApplication(data: unknown): Promise<Result<{ id: string }>> {
	const ws = await requireWorkspace();
	const parsed = applicationSchema.safeParse(data);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

	const values = valuesOf(parsed.data);
	const id = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(kyuuApplications)
			.values({ workspaceId: ws.id, ...values })
			.returning({ id: kyuuApplications.id });
		// Logged at a stage already: say so on its timeline, on the day it went out.
		const kind = {
			hr_screening: "screening",
			technical_interview: "interview",
			offer: "offer",
			rejected: "rejected",
			withdrawn: "withdrawn",
			ghosted: "ghosted",
		}[values.status as string] as KyuuEvent["kind"] | undefined;
		if (kind) await tx.insert(kyuuEvents).values({ applicationId: created.id, kind, date: null });
		return created.id;
	});
	revalidateKyuu();
	return { success: true, data: { id } };
}

/** One field from the application's page, saved as it's edited. */
export async function patchApplication(
	applicationId: string,
	patch: ApplicationPatch,
): Promise<Result> {
	const owned = await getOwnedApplication(applicationId);
	if (!owned) return { error: "Application not found" };
	const parsed = applicationPatchSchema.safeParse(patch);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
	const set: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(parsed.data)) {
		// Blank optional text is no value; a source gets its one spelling.
		const blank = typeof value === "string" && !value.trim();
		if (key === "country") {
			const code = blank || value == null ? null : toCountryCode(value);
			if (!blank && value != null && !code) return { error: "Unknown country" };
			set.country = code;
			continue;
		}
		set[key] = key === "source" ? normalizeSource(value as string | null) : blank ? null : value;
	}
	if (Object.keys(set).length === 0) return { success: true };
	await db
		.update(kyuuApplications)
		.set({ ...set, updatedAt: new Date() })
		.where(eq(kyuuApplications.id, owned.id));
	revalidateKyuu();
	return { success: true };
}

export async function deleteApplication(applicationId: string): Promise<Result> {
	const owned = await getOwnedApplication(applicationId);
	if (!owned) return { error: "Application not found" };
	await db.delete(kyuuApplications).where(eq(kyuuApplications.id, owned.id));
	revalidateKyuu();
	return { success: true };
}

/** Settings: every application from one source moves to another (merging two spellings). */
export async function renameSource(from: string, to: string): Promise<Result<{ count: number }>> {
	const ws = await requireWorkspace();
	const target = normalizeSource(to);
	if (!from || !target) return { error: "Name the source" };
	if (target === from) return { success: true, data: { count: 0 } };
	const moved = await db
		.update(kyuuApplications)
		.set({ source: target })
		.where(and(eq(kyuuApplications.workspaceId, ws.id), eq(kyuuApplications.source, from)))
		.returning({ id: kyuuApplications.id });
	revalidateKyuu();
	return { success: true, data: { count: moved.length } };
}
