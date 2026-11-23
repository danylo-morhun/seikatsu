ALTER TABLE "workspaces" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- Everyone already here has set up their apps: only new users go through /welcome.
UPDATE "workspaces" SET "onboarded_at" = "created_at";
