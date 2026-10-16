CREATE TYPE "public"."kyuu_event_kind" AS ENUM('screening', 'interview', 'offer', 'rejected', 'withdrawn', 'ghosted', 'follow_up');--> statement-breakpoint
ALTER TYPE "public"."kyuu_status" ADD VALUE 'ghosted';--> statement-breakpoint
CREATE TABLE "kyuu_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" "kyuu_event_kind" NOT NULL,
	"date" date,
	"time" time,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "contact" text;--> statement-breakpoint
ALTER TABLE "kyuu_events" ADD CONSTRAINT "kyuu_events_application_id_kyuu_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."kyuu_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kyuu_events_application_id_idx" ON "kyuu_events" USING btree ("application_id");--> statement-breakpoint
-- Retired statuses: under review is still waiting, a video interview is a screen.
UPDATE "kyuu_applications" SET "status" = 'applied' WHERE "status" = 'under_review';--> statement-breakpoint
UPDATE "kyuu_applications" SET "status" = 'hr_screening' WHERE "status" = 'video_interview';--> statement-breakpoint
-- The stage ticks become events. A stamp within minutes of the row's creation was the backfill,
-- not the day it happened: those dates are unknown.
INSERT INTO "kyuu_events" ("application_id", "kind", "date", "created_at")
SELECT "id", 'screening'::"kyuu_event_kind",
	CASE WHEN "hr_screening_at" IS NULL OR "hr_screening_at" < "created_at" + interval '5 minutes' THEN NULL ELSE "hr_screening_at"::date END,
	coalesce("hr_screening_at", "created_at")
FROM "kyuu_applications" WHERE "hr_screening" OR "status" = 'hr_screening';--> statement-breakpoint
INSERT INTO "kyuu_events" ("application_id", "kind", "date", "created_at")
SELECT "id", 'interview'::"kyuu_event_kind",
	CASE WHEN "technical_interview_at" IS NULL OR "technical_interview_at" < "created_at" + interval '5 minutes' THEN NULL ELSE "technical_interview_at"::date END,
	coalesce("technical_interview_at", "created_at")
FROM "kyuu_applications" WHERE "technical_interview" OR "status" = 'technical_interview';--> statement-breakpoint
INSERT INTO "kyuu_events" ("application_id", "kind", "date", "created_at")
SELECT "id", 'offer'::"kyuu_event_kind",
	CASE WHEN "offer_at" IS NULL OR "offer_at" < "created_at" + interval '5 minutes' THEN NULL ELSE "offer_at"::date END,
	coalesce("offer_at", "created_at")
FROM "kyuu_applications" WHERE "offer" OR "status" = 'offer';--> statement-breakpoint
INSERT INTO "kyuu_events" ("application_id", "kind", "date", "created_at")
SELECT "id", 'rejected'::"kyuu_event_kind",
	CASE WHEN "rejected_at" IS NULL OR "rejected_at" < "created_at" + interval '5 minutes' THEN NULL ELSE "rejected_at"::date END,
	coalesce("rejected_at", "updated_at")
FROM "kyuu_applications" WHERE "status" = 'rejected';--> statement-breakpoint
INSERT INTO "kyuu_events" ("application_id", "kind", "date", "created_at")
SELECT "id", 'withdrawn'::"kyuu_event_kind", NULL, "updated_at"
FROM "kyuu_applications" WHERE "status" = 'withdrawn';--> statement-breakpoint
-- A ticked stage on an "applied" row moves the status up to the furthest one.
UPDATE "kyuu_applications" SET "status" = CASE
	WHEN "offer" THEN 'offer'::"kyuu_status"
	WHEN "technical_interview" THEN 'technical_interview'::"kyuu_status"
	ELSE 'hr_screening'::"kyuu_status" END
WHERE "status" = 'applied' AND ("hr_screening" OR "technical_interview" OR "offer");--> statement-breakpoint
-- One spelling per board.
UPDATE "kyuu_applications" SET "source" = 'JustJoin' WHERE lower("source") IN ('justjoin.it', 'justjoin');--> statement-breakpoint
UPDATE "kyuu_applications" SET "source" = NULL WHERE trim("source") = '';
