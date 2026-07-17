ALTER TABLE "kyuu_applications" ADD COLUMN "hr_screening_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "technical_interview_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "offer_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "rejected_at" timestamp with time zone;