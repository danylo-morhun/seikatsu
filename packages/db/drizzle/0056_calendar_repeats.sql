ALTER TABLE "calendar_events" ADD COLUMN "repeat_count" integer;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "repeat_days" integer[];--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "repeat_by_weekday" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "skip" date[] DEFAULT '{}' NOT NULL;