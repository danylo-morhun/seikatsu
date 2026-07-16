CREATE TYPE "public"."kyuu_status" AS ENUM('applied', 'hr_screening', 'technical_interview', 'offer', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "kyuu_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"job_url" text,
	"source" text,
	"status" "kyuu_status" DEFAULT 'applied' NOT NULL,
	"hr_screening" boolean DEFAULT false NOT NULL,
	"technical_interview" boolean DEFAULT false NOT NULL,
	"offer" boolean DEFAULT false NOT NULL,
	"date_applied" date NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD CONSTRAINT "kyuu_applications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kyuu_applications_workspace_id_idx" ON "kyuu_applications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "kyuu_applications_status_idx" ON "kyuu_applications" USING btree ("status");