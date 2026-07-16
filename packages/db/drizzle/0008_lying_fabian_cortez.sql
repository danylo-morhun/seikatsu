CREATE TYPE "public"."keizoku_frequency" AS ENUM('daily', 'weekdays', 'times_per_week');--> statement-breakpoint
CREATE TABLE "keizoku_habit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"photo_url" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keizoku_habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"frequency_type" "keizoku_frequency" NOT NULL,
	"frequency_days" integer[],
	"frequency_target" integer,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keizoku_habit_logs" ADD CONSTRAINT "keizoku_habit_logs_habit_id_keizoku_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."keizoku_habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keizoku_habits" ADD CONSTRAINT "keizoku_habits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "keizoku_habit_logs_habit_date_idx" ON "keizoku_habit_logs" USING btree ("habit_id","date");--> statement-breakpoint
CREATE INDEX "keizoku_habit_logs_habit_id_idx" ON "keizoku_habit_logs" USING btree ("habit_id");--> statement-breakpoint
CREATE INDEX "keizoku_habits_workspace_id_idx" ON "keizoku_habits" USING btree ("workspace_id");