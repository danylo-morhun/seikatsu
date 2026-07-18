import { relations } from "drizzle-orm";
import { boolean, date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

export const kyuuStatusEnum = pgEnum("kyuu_status", [
	"applied",
	"hr_screening",
	"technical_interview",
	"offer",
	"rejected",
	"withdrawn",
]);

export const kyuuApplications = pgTable(
	"kyuu_applications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		company: text("company").notNull(),
		role: text("role").notNull(),
		jobUrl: text("job_url"),
		source: text("source"),
		resumeFileUrl: text("resume_file_url"),
		resumeFileName: text("resume_file_name"),
		status: kyuuStatusEnum("status").notNull().default("applied"),
		hrScreening: boolean("hr_screening").notNull().default(false),
		technicalInterview: boolean("technical_interview").notNull().default(false),
		offer: boolean("offer").notNull().default(false),
		dateApplied: date("date_applied").notNull(),
		notes: text("notes"),
		hrScreeningAt: timestamp("hr_screening_at", { withTimezone: true }),
		technicalInterviewAt: timestamp("technical_interview_at", { withTimezone: true }),
		offerAt: timestamp("offer_at", { withTimezone: true }),
		rejectedAt: timestamp("rejected_at", { withTimezone: true }),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("kyuu_applications_workspace_id_idx").on(t.workspaceId),
		index("kyuu_applications_status_idx").on(t.status),
	],
);

export const kyuuApplicationsRelations = relations(kyuuApplications, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [kyuuApplications.workspaceId],
		references: [workspaces.id],
	}),
}));
