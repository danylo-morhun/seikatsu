CREATE TYPE "public"."bank_connection_status" AS ENUM('CREATED', 'LINKED', 'EXPIRED', 'ERROR');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"account_uid" text NOT NULL,
	"iban" text,
	"name" text NOT NULL,
	"currency" text,
	"account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"aspsp_name" text NOT NULL,
	"aspsp_country" text NOT NULL,
	"display_name" text NOT NULL,
	"auth_state" text NOT NULL,
	"session_id" text,
	"status" "bank_connection_status" DEFAULT 'CREATED' NOT NULL,
	"access_expires_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"import_from_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"match_text" text NOT NULL,
	"account_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_rules" ADD CONSTRAINT "bank_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_rules" ADD CONSTRAINT "bank_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_accounts_connection_id_idx" ON "bank_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_account_uid_idx" ON "bank_accounts" USING btree ("account_uid");--> statement-breakpoint
CREATE INDEX "bank_connections_workspace_id_idx" ON "bank_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_connections_auth_state_idx" ON "bank_connections" USING btree ("auth_state");--> statement-breakpoint
CREATE INDEX "bank_rules_workspace_id_idx" ON "bank_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_workspace_external_id_idx" ON "transactions" USING btree ("workspace_id","external_id");