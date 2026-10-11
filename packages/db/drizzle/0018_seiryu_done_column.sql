ALTER TABLE "seiryu_columns" ADD COLUMN "is_done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "seiryu_columns" SET "is_done" = true WHERE lower(trim("name")) = 'done';
