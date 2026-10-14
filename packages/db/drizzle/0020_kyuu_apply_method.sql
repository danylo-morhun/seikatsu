CREATE TYPE "public"."kyuu_apply_method" AS ENUM('manual', 'auto');--> statement-breakpoint
ALTER TABLE "kyuu_applications" ADD COLUMN "apply_method" "kyuu_apply_method" DEFAULT 'manual' NOT NULL;