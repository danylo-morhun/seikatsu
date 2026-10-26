CREATE TYPE "public"."kyuu_mail_state" AS ENUM('applied', 'review', 'dismissed', 'skipped');--> statement-breakpoint
CREATE TABLE "kyuu_mail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"state" "kyuu_mail_state" NOT NULL,
	"sender" text,
	"subject" text,
	"link" text,
	"received_at" timestamp with time zone,
	"application_id" uuid,
	"kind" "kyuu_event_kind",
	"event_date" date,
	"event_time" time,
	"summary" text,
	"event_id" uuid,
	"previous_status" "kyuu_status",
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyuu_mail_keys" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	CONSTRAINT "kyuu_mail_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "kyuu_mail" ADD CONSTRAINT "kyuu_mail_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyuu_mail" ADD CONSTRAINT "kyuu_mail_application_id_kyuu_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."kyuu_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyuu_mail" ADD CONSTRAINT "kyuu_mail_event_id_kyuu_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."kyuu_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyuu_mail_keys" ADD CONSTRAINT "kyuu_mail_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kyuu_mail_message_idx" ON "kyuu_mail" USING btree ("workspace_id","message_id");--> statement-breakpoint
CREATE INDEX "kyuu_mail_state_idx" ON "kyuu_mail" USING btree ("workspace_id","state");