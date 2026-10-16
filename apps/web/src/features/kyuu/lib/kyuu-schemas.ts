import { z } from "zod";
import { STATUSES } from "./stages";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** The New/Edit dialog. Notes, events and the posting's long text are edited on the sheet. */
export const applicationSchema = z.object({
	company: z.string().trim().min(1, "Company required").max(200),
	role: z.string().trim().min(1, "Role required").max(300),
	jobUrl: z.string().trim().url("Must be a valid URL").optional().or(z.literal("")),
	source: optionalText(100),
	status: z.enum(STATUSES),
	dateApplied: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date required"),
	contact: optionalText(500),
	salary: optionalText(200),
	location: optionalText(200),
	notes: optionalText(10_000),
	resumeFileUrl: z.string().url().optional().or(z.literal("")),
	resumeFileName: optionalText(300),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;

/** One field at a time from the application's page, saved as it's edited. */
export const applicationPatchSchema = z
	.object({
		company: z.string().trim().min(1, "Company required").max(200),
		role: z.string().trim().min(1, "Role required").max(300),
		jobUrl: z.string().trim().url("Must be a valid URL").or(z.literal("")).nullable(),
		source: z.string().trim().max(100).nullable(),
		dateApplied: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
		contact: z.string().trim().max(500).nullable(),
		location: z.string().trim().max(200).nullable(),
		salary: z.string().trim().max(200).nullable(),
		notes: z.string().max(10_000).nullable(),
	})
	.partial();

export type ApplicationPatch = z.infer<typeof applicationPatchSchema>;

export const kyuuApplyMethodValues = ["manual", "auto"] as const;
export type KyuuApplyMethod = (typeof kyuuApplyMethodValues)[number];

/** The table's views: a status group each, plus the archive. */
export const KYUU_VIEWS = ["all", "queue", "waiting", "active", "closed", "archived"] as const;
export type KyuuView = (typeof KYUU_VIEWS)[number];
