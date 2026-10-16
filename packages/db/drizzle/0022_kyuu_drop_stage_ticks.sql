ALTER TABLE "kyuu_applications" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
-- Anything set to a retired status since 0021 (old code still running) reads as its v2 meaning.
UPDATE "kyuu_applications" SET "status" = 'applied' WHERE "status" = 'under_review';--> statement-breakpoint
UPDATE "kyuu_applications" SET "status" = 'hr_screening' WHERE "status" = 'video_interview';--> statement-breakpoint
ALTER TABLE "kyuu_applications" ALTER COLUMN "status" SET DEFAULT 'applied'::text;--> statement-breakpoint
DROP TYPE "public"."kyuu_status";--> statement-breakpoint
CREATE TYPE "public"."kyuu_status" AS ENUM('sourced', 'drafted', 'applied', 'hr_screening', 'technical_interview', 'offer', 'rejected', 'withdrawn', 'ghosted');--> statement-breakpoint
ALTER TABLE "kyuu_applications" ALTER COLUMN "status" SET DEFAULT 'applied'::"public"."kyuu_status";--> statement-breakpoint
ALTER TABLE "kyuu_applications" ALTER COLUMN "status" SET DATA TYPE "public"."kyuu_status" USING "status"::"public"."kyuu_status";--> statement-breakpoint
ALTER TABLE "kyuu_applications" DROP COLUMN "hr_screening";--> statement-breakpoint
ALTER TABLE "kyuu_applications" DROP COLUMN "technical_interview";--> statement-breakpoint
ALTER TABLE "kyuu_applications" DROP COLUMN "offer";--> statement-breakpoint
ALTER TABLE "kyuu_applications" DROP COLUMN "hr_screening_at";--> statement-breakpoint
ALTER TABLE "kyuu_applications" DROP COLUMN "technical_interview_at";--> statement-breakpoint
ALTER TABLE "kyuu_applications" DROP COLUMN "offer_at";--> statement-breakpoint
ALTER TABLE "kyuu_applications" DROP COLUMN "rejected_at";