ALTER TABLE "notification_prefs" ADD COLUMN "seiryu_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD COLUMN "due_time" time;--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD COLUMN "remind_minutes" integer;--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD COLUMN "remind_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "seiryu_cards_remind_at_idx" ON "seiryu_cards" USING btree ("remind_at");