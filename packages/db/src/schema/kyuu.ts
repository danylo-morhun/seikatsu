import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	pgEnum,
	pgTable,
	text,
	time,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

export const kyuuStatusEnum = pgEnum("kyuu_status", [
	"sourced",
	"drafted",
	"applied",
	"hr_screening",
	"technical_interview",
	"offer",
	"rejected",
	"withdrawn",
	"ghosted",
]);

// How the application went out: "auto" = submitted by the job-search pipeline's
// headless applier, "manual" = sent by hand (or the default for anything added in the UI).
export const kyuuApplyMethodEnum = pgEnum("kyuu_apply_method", ["manual", "auto"]);

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
		applyMethod: kyuuApplyMethodEnum("apply_method").notNull().default("manual"),
		dateApplied: date("date_applied").notNull(),
		notes: text("notes"),
		// Who to talk to: a recruiter's name, email, Telegram — free text.
		contact: text("contact"),
		// Filled by the job-search tailoring workflow (see Projects/Personal/job-search).
		jobDescription: text("job_description"),
		coverLetter: text("cover_letter"),
		location: text("location"),
		// ISO 3166-1 alpha-2 of where the job is (or the company, for remote roles); null if unknown.
		country: text("country"),
		remote: boolean("remote"),
		salary: text("salary"),
		fitVerdict: text("fit_verdict"),
		stackTags: text("stack_tags").array(),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("kyuu_applications_workspace_id_idx").on(t.workspaceId),
		index("kyuu_applications_status_idx").on(t.status),
	],
);

// What happened to an application, and what's booked: a screen, an interview, the answer.
export const kyuuEventKindEnum = pgEnum("kyuu_event_kind", [
	"screening",
	"interview",
	"offer",
	"rejected",
	"withdrawn",
	"ghosted",
	"follow_up",
]);

export const kyuuEvents = pgTable(
	"kyuu_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		applicationId: uuid("application_id")
			.notNull()
			.references(() => kyuuApplications.id, { onDelete: "cascade" }),
		kind: kyuuEventKindEnum("kind").notNull(),
		// Null when the day isn't known (stages ticked long after they happened, before v2).
		date: date("date"),
		time: time("time"),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("kyuu_events_application_id_idx").on(t.applicationId)],
);

export const kyuuApplicationsRelations = relations(kyuuApplications, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [kyuuApplications.workspaceId],
		references: [workspaces.id],
	}),
	events: many(kyuuEvents),
}));

export const kyuuEventsRelations = relations(kyuuEvents, ({ one }) => ({
	application: one(kyuuApplications, {
		fields: [kyuuEvents.applicationId],
		references: [kyuuApplications.id],
	}),
}));

// ── Mail sync ──
// A Google Apps Script in the user's Gmail posts new mail to /api/kyuu/mail with a key;
// replies about an application become events (or wait for review).

/** One key per workspace; only its hash is stored. */
export const kyuuMailKeys = pgTable("kyuu_mail_keys", {
	workspaceId: uuid("workspace_id")
		.primaryKey()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	keyHash: text("key_hash").notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
});

export const kyuuMailStateEnum = pgEnum("kyuu_mail_state", [
	// Logged as an event on its own; can be undone.
	"applied",
	// An answer Gemini wasn't sure of, or couldn't tie to an application.
	"review",
	"dismissed",
	// Not about an application (or already on the timeline): kept only so it isn't read again.
	"skipped",
]);

export const kyuuMail = pgTable(
	"kyuu_mail",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		// Gmail's message id.
		messageId: text("message_id").notNull(),
		state: kyuuMailStateEnum("state").notNull(),
		// Null on skipped mail: nothing of it is kept.
		sender: text("sender"),
		subject: text("subject"),
		link: text("link"),
		receivedAt: timestamp("received_at", { withTimezone: true }),
		applicationId: uuid("application_id").references(() => kyuuApplications.id, {
			onDelete: "set null",
		}),
		kind: kyuuEventKindEnum("kind"),
		// A booked screen or interview's day and time, when the mail names one.
		eventDate: date("event_date"),
		eventTime: time("event_time"),
		summary: text("summary"),
		// What applying it did, to undo it.
		eventId: uuid("event_id").references(() => kyuuEvents.id, { onDelete: "set null" }),
		previousStatus: kyuuStatusEnum("previous_status"),
		// Applied ones leave the table's mail bar once looked at.
		seenAt: timestamp("seen_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("kyuu_mail_message_idx").on(t.workspaceId, t.messageId),
		index("kyuu_mail_state_idx").on(t.workspaceId, t.state),
	],
);

export const kyuuMailRelations = relations(kyuuMail, ({ one }) => ({
	application: one(kyuuApplications, {
		fields: [kyuuMail.applicationId],
		references: [kyuuApplications.id],
	}),
}));
