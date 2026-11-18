CREATE TABLE "week_plans" (
	"workspace_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"focus" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ticked" text[] DEFAULT '{}' NOT NULL,
	"planned_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "week_plans_workspace_id_week_start_pk" PRIMARY KEY("workspace_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "day_plans" ADD COLUMN "result" jsonb;--> statement-breakpoint
ALTER TABLE "week_plans" ADD CONSTRAINT "week_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;