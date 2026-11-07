import { z } from "zod";
import {
	getApplication,
	getApplicationsPage,
	getStats,
	getViewCounts,
} from "@/features/kyuu/actions/applications";
import { logEvent, setArchived, setStatus } from "@/features/kyuu/actions/progress";
import { KYUU_VIEWS } from "@/features/kyuu/lib/kyuu-schemas";
import { EVENT_KINDS, STATUSES } from "@/features/kyuu/lib/stages";
import { day } from "./shell";
import { tool } from "./types";

const id = z.uuid();

export const kyuuTools = [
	tool({
		name: "kyuu_applications",
		title: "Kyuu applications",
		description:
			"Job applications, 50 per page, newest first. Views: all, queue (not sent), waiting (sent, no answer), active (screening/interview/offer), closed, archived. Filters: q (company/role), source, from/to (date applied). Each row: status, next booked call, how long it's been waiting. `counts` = rows per view.",
		input: {
			view: z.enum(KYUU_VIEWS).default("all"),
			q: z.string().max(200).optional(),
			source: z.string().max(100).optional(),
			from: day.optional(),
			to: day.optional(),
			sort: z.enum(["date", "company", "status"]).default("date"),
			page: z.number().int().min(0).default(0),
		},
		run: async ({ sort, page, ...filters }) => {
			const [res, counts] = await Promise.all([
				getApplicationsPage(filters, { sort, dir: sort === "date" ? "desc" : "asc", page }),
				getViewCounts(),
			]);
			return {
				counts,
				total: res.total,
				page,
				rows: res.rows.map(({ notes, jobUrl, applyMethod, ...r }) => ({
					...r,
					notes: notes && notes.length > 200 ? `${notes.slice(0, 200)}…` : notes,
				})),
			};
		},
	}),
	tool({
		name: "kyuu_application",
		title: "Kyuu application",
		description:
			"One application with its event timeline (screenings, interviews, follow-ups, answers), contact, salary, fit verdict. `full` adds the job description and cover letter (long).",
		input: { applicationId: id, full: z.boolean().default(false) },
		run: async ({ applicationId, full }) => {
			const res = await getApplication(applicationId);
			if ("error" in res) return res;
			const { jobDescription, coverLetter, resumeFileUrl, ...rest } = res.data;
			return full ? { ...rest, jobDescription, coverLetter } : rest;
		},
	}),
	tool({
		name: "kyuu_stats",
		title: "Kyuu stats",
		description:
			"Funnel and response stats for the job search (optionally a date range of applying).",
		input: { from: day.optional(), to: day.optional() },
		run: ({ from, to }) => getStats({ view: "all", from, to }),
	}),
	tool({
		name: "kyuu_set_status",
		title: "Set an application's status",
		description: `Move an application to a status (${STATUSES.join(", ")}). Reaching a stage logs it as an event dated today, as in the app.`,
		input: { applicationId: id, status: z.enum(STATUSES) },
		write: true,
		idempotent: true,
		run: ({ applicationId, status }) => setStatus(applicationId, status),
	}),
	tool({
		name: "kyuu_log_event",
		title: "Log an application event",
		description: `Add an event to an application's timeline: ${EVENT_KINDS.join(", ")}. A booked call gets its date (and HH:MM time); the status follows, as in the app. Pass a fresh requestId (uuid) so a retry lands once.`,
		input: {
			applicationId: id,
			kind: z.enum(EVENT_KINDS),
			date: day.nullable().default(null),
			time: z
				.string()
				.regex(/^\d{2}:\d{2}$/)
				.nullable()
				.default(null),
			note: z.string().max(2000).nullable().default(null),
			requestId: id.optional(),
		},
		write: true,
		idempotent: true,
		run: ({ applicationId, requestId, ...event }) =>
			logEvent(applicationId, { id: requestId, ...event }),
	}),
	tool({
		name: "kyuu_archive",
		title: "Archive an application",
		description: "Archive (or unarchive) an application.",
		input: { applicationId: id, archived: z.boolean().default(true) },
		write: true,
		idempotent: true,
		run: ({ applicationId, archived }) => setArchived(applicationId, archived),
	}),
];
