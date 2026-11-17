CREATE TABLE "seiryu_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "seiryu_groups" ADD CONSTRAINT "seiryu_groups_project_id_seiryu_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."seiryu_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seiryu_groups_project_id_idx" ON "seiryu_groups" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seiryu_groups_project_name_idx" ON "seiryu_groups" USING btree ("project_id","name");--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD CONSTRAINT "seiryu_cards_group_id_seiryu_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."seiryu_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seiryu_cards_group_id_idx" ON "seiryu_cards" USING btree ("group_id");