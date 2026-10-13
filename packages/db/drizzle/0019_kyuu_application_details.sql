ALTER TABLE "kyuu_applications" ADD COLUMN "job_description" text;--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "cover_letter" text;--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "remote" boolean;--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "salary" text;--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "fit_verdict" text;--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "stack_tags" text[];