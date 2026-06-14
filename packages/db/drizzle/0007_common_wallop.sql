CREATE TYPE "public"."tsundoku_book_status" AS ENUM('want', 'reading', 'read', 'dnf', 'paused');--> statement-breakpoint
CREATE TABLE "tsundoku_book_shelves" (
	"book_id" uuid NOT NULL,
	"shelf_id" uuid NOT NULL,
	CONSTRAINT "tsundoku_book_shelves_book_id_shelf_id_pk" PRIMARY KEY("book_id","shelf_id")
);
--> statement-breakpoint
CREATE TABLE "tsundoku_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"authors" text[],
	"isbn" text,
	"cover_url" text,
	"ol_key" text,
	"page_count" integer,
	"published_year" integer,
	"description" text,
	"genre" text,
	"series_name" text,
	"series_position" integer,
	"source" text DEFAULT 'openlibrary' NOT NULL,
	"status" "tsundoku_book_status" DEFAULT 'want' NOT NULL,
	"rating" integer,
	"review" text,
	"current_page" integer DEFAULT 0 NOT NULL,
	"started_at" date,
	"finished_at" date,
	"position" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tsundoku_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"target_books" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tsundoku_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"page" integer,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tsundoku_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"date" date NOT NULL,
	"pages_read" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tsundoku_shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"position" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tsundoku_book_shelves" ADD CONSTRAINT "tsundoku_book_shelves_book_id_tsundoku_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."tsundoku_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tsundoku_book_shelves" ADD CONSTRAINT "tsundoku_book_shelves_shelf_id_tsundoku_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."tsundoku_shelves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tsundoku_books" ADD CONSTRAINT "tsundoku_books_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tsundoku_goals" ADD CONSTRAINT "tsundoku_goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tsundoku_quotes" ADD CONSTRAINT "tsundoku_quotes_book_id_tsundoku_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."tsundoku_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tsundoku_sessions" ADD CONSTRAINT "tsundoku_sessions_book_id_tsundoku_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."tsundoku_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tsundoku_shelves" ADD CONSTRAINT "tsundoku_shelves_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tsundoku_book_shelves_book_id_idx" ON "tsundoku_book_shelves" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "tsundoku_book_shelves_shelf_id_idx" ON "tsundoku_book_shelves" USING btree ("shelf_id");--> statement-breakpoint
CREATE INDEX "tsundoku_books_workspace_id_idx" ON "tsundoku_books" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tsundoku_goals_workspace_year_idx" ON "tsundoku_goals" USING btree ("workspace_id","year");--> statement-breakpoint
CREATE INDEX "tsundoku_quotes_book_id_idx" ON "tsundoku_quotes" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "tsundoku_sessions_book_id_idx" ON "tsundoku_sessions" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "tsundoku_shelves_workspace_id_idx" ON "tsundoku_shelves" USING btree ("workspace_id");