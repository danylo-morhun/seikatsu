CREATE TABLE "google_accounts" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token" text,
	"access_expires_at" timestamp with time zone,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"own_calendar_id" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"google_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"shown" boolean DEFAULT true NOT NULL,
	"writable" boolean DEFAULT false NOT NULL,
	"own" boolean DEFAULT false NOT NULL,
	"channel_id" text,
	"channel_resource_id" text,
	"channel_token" text,
	"channel_expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "google_events" (
	"calendar_id" uuid NOT NULL,
	"google_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"end_date" date,
	"start_time" time,
	"end_time" time,
	"location" text,
	"note" text,
	"link" text,
	"recurring" boolean DEFAULT false NOT NULL,
	CONSTRAINT "google_events_calendar_id_google_id_pk" PRIMARY KEY("calendar_id","google_id")
);
--> statement-breakpoint
CREATE TABLE "google_mirror" (
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"google_id" text NOT NULL,
	"date" date NOT NULL,
	"hash" text NOT NULL,
	"updated" text NOT NULL,
	CONSTRAINT "google_mirror_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendars" ADD CONSTRAINT "google_calendars_workspace_id_google_accounts_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."google_accounts"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_events" ADD CONSTRAINT "google_events_calendar_id_google_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."google_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_mirror" ADD CONSTRAINT "google_mirror_workspace_id_google_accounts_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."google_accounts"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendars_workspace_google_idx" ON "google_calendars" USING btree ("workspace_id","google_id");--> statement-breakpoint
CREATE INDEX "google_calendars_channel_idx" ON "google_calendars" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "google_events_workspace_date_idx" ON "google_events" USING btree ("workspace_id","date");