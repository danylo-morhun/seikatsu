CREATE TABLE "kuroji_budget_months" (
	"account_id" uuid NOT NULL,
	"month" date NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	CONSTRAINT "kuroji_budget_months_account_id_month_pk" PRIMARY KEY("account_id","month")
);
--> statement-breakpoint
CREATE TABLE "kuroji_funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target" numeric(19, 4) NOT NULL,
	"due_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kuroji_budget_months" ADD CONSTRAINT "kuroji_budget_months_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kuroji_funds" ADD CONSTRAINT "kuroji_funds_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kuroji_funds" ADD CONSTRAINT "kuroji_funds_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kuroji_funds_workspace_id_idx" ON "kuroji_funds" USING btree ("workspace_id");