CREATE TYPE "public"."hoshii_state" AS ENUM('cooling', 'plan', 'bought', 'released');--> statement-breakpoint
CREATE TABLE "hoshii_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"list_id" uuid,
	"title" text NOT NULL,
	"url" text,
	"image_url" text,
	"price" numeric(19, 4),
	"currency" text NOT NULL,
	"note" text,
	"state" "hoshii_state" DEFAULT 'cooling' NOT NULL,
	"added_on" date NOT NULL,
	"cool_until" date NOT NULL,
	"skipped_cooling" boolean DEFAULT false NOT NULL,
	"plan_position" text,
	"kept_on" date,
	"bought_on" date,
	"bought_price" numeric(19, 4),
	"bought_currency" text,
	"released_on" date,
	"kuroji_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hoshii_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hoshii_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"piggy_account_id" uuid,
	"wallet_id" uuid,
	"category_id" uuid,
	"small_below" integer DEFAULT 100 NOT NULL,
	"large_from" integer DEFAULT 1000 NOT NULL,
	"small_days" integer DEFAULT 7 NOT NULL,
	"mid_days" integer DEFAULT 30 NOT NULL,
	"large_days" integer DEFAULT 60 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hoshii_items" ADD CONSTRAINT "hoshii_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hoshii_items" ADD CONSTRAINT "hoshii_items_list_id_hoshii_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."hoshii_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hoshii_items" ADD CONSTRAINT "hoshii_items_kuroji_transaction_id_transactions_id_fk" FOREIGN KEY ("kuroji_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hoshii_lists" ADD CONSTRAINT "hoshii_lists_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hoshii_settings" ADD CONSTRAINT "hoshii_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hoshii_settings" ADD CONSTRAINT "hoshii_settings_piggy_account_id_accounts_id_fk" FOREIGN KEY ("piggy_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hoshii_settings" ADD CONSTRAINT "hoshii_settings_wallet_id_accounts_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hoshii_settings" ADD CONSTRAINT "hoshii_settings_category_id_accounts_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hoshii_items_workspace_id_idx" ON "hoshii_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "hoshii_items_list_id_idx" ON "hoshii_items" USING btree ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hoshii_lists_workspace_name_idx" ON "hoshii_lists" USING btree ("workspace_id","name");