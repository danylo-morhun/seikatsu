import { z } from "zod";

export const kyuuStatusValues = [
	"applied",
	"hr_screening",
	"technical_interview",
	"offer",
	"rejected",
	"withdrawn",
] as const;

export const applicationSchema = z.object({
	company: z.string().min(1, "Company required"),
	role: z.string().min(1, "Role required"),
	jobUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
	source: z.string().optional(),
	resumeFileUrl: z.string().url().optional().or(z.literal("")),
	resumeFileName: z.string().optional(),
	status: z.enum(kyuuStatusValues),
	hrScreening: z.boolean(),
	technicalInterview: z.boolean(),
	offer: z.boolean(),
	dateApplied: z.string().min(1, "Date required"),
	notes: z.string().optional(),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;
export type KyuuStatus = (typeof kyuuStatusValues)[number];

export const kyuuFilterStatusValues = [...kyuuStatusValues, "ignored"] as const;
export type KyuuFilterStatus = (typeof kyuuFilterStatusValues)[number];
