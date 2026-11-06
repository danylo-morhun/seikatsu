CREATE TYPE "public"."seiryu_repeat_unit" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD COLUMN "repeat_every" integer;--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD COLUMN "repeat_unit" "seiryu_repeat_unit";--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD COLUMN "repeat_from_done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD COLUMN "next_card_id" uuid;--> statement-breakpoint
ALTER TABLE "seiryu_cards" ADD CONSTRAINT "seiryu_cards_next_card_id_seiryu_cards_id_fk" FOREIGN KEY ("next_card_id") REFERENCES "public"."seiryu_cards"("id") ON DELETE set null ON UPDATE no action;