CREATE TABLE "seiryu_calendar_feeds" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seiryu_calendar_feeds_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "seiryu_calendar_feeds" ADD CONSTRAINT "seiryu_calendar_feeds_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;