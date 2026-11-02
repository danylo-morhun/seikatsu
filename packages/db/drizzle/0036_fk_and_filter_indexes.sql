DROP INDEX "transactions_workspace_id_idx";--> statement-breakpoint
DROP INDEX "kyuu_applications_workspace_id_idx";--> statement-breakpoint
DROP INDEX "kyuu_applications_status_idx";--> statement-breakpoint
CREATE INDEX "accounts_parent_id_idx" ON "accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "recurring_transactions_from_account_id_idx" ON "recurring_transactions" USING btree ("from_account_id");--> statement-breakpoint
CREATE INDEX "recurring_transactions_to_account_id_idx" ON "recurring_transactions" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "transaction_tags_tag_id_idx" ON "transaction_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "transactions_workspace_date_idx" ON "transactions" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX "kyuu_applications_workspace_status_idx" ON "kyuu_applications" USING btree ("workspace_id","status");