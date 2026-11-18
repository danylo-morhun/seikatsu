CREATE TABLE "day_plans" (
	"workspace_id" uuid NOT NULL,
	"day" date NOT NULL,
	"picks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ticked" text[] DEFAULT '{}' NOT NULL,
	"planned_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_plans_workspace_id_day_pk" PRIMARY KEY("workspace_id","day")
);
--> statement-breakpoint
CREATE TABLE "day_snoozes" (
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"until" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_snoozes_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD COLUMN "evening_close" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD COLUMN "evening_time" time DEFAULT '19:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_snoozes" ADD CONSTRAINT "day_snoozes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;