CREATE TYPE "public"."goal_link_kind" AS ENUM('fund', 'project', 'habit', 'list', 'shelf', 'jobs');--> statement-breakpoint
CREATE TABLE "goal_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"kind" "goal_link_kind" NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"target_date" date,
	"position" varchar(255) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_links" ADD CONSTRAINT "goal_links_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_links_goal_id_idx" ON "goal_links" USING btree ("goal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_links_goal_kind_ref_uq" ON "goal_links" USING btree ("goal_id","kind","ref_id");--> statement-breakpoint
CREATE INDEX "goals_workspace_id_idx" ON "goals" USING btree ("workspace_id");