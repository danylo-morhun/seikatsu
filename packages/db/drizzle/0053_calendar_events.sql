CREATE TYPE "public"."calendar_repeat" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"end_date" date,
	"start_time" time,
	"end_time" time,
	"repeat" "calendar_repeat",
	"repeat_every" integer DEFAULT 1 NOT NULL,
	"repeat_until" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_workspace_date_idx" ON "calendar_events" USING btree ("workspace_id","date");