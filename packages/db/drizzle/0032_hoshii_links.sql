ALTER TABLE "hoshii_items" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "hoshii_items" SET "links" = jsonb_build_array(jsonb_build_object('url', "url", 'title', NULL, 'imageUrl', NULL, 'price', NULL, 'currency', NULL)) WHERE "url" IS NOT NULL;
