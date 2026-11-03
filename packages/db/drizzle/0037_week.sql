ALTER TABLE "notification_prefs" ADD COLUMN "week_recap" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD COLUMN "done_on" date;