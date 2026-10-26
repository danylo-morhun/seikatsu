CREATE TYPE "public"."kuroji_capture_state" AS ENUM('pending', 'added', 'matched', 'dismissed');--> statement-breakpoint
CREATE TABLE "kuroji_capture_keys" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "kuroji_capture_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "kuroji_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"currency" text NOT NULL,
	"merchant" text NOT NULL,
	"card" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state" "kuroji_capture_state" DEFAULT 'pending' NOT NULL,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kuroji_capture_keys" ADD CONSTRAINT "kuroji_capture_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kuroji_captures" ADD CONSTRAINT "kuroji_captures_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kuroji_captures" ADD CONSTRAINT "kuroji_captures_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kuroji_captures_workspace_state_idx" ON "kuroji_captures" USING btree ("workspace_id","state");