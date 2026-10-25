ALTER TABLE "aisha_maintenance_items" ADD COLUMN "baseline_date" date;--> statement-breakpoint
ALTER TABLE "aisha_maintenance_items" ADD COLUMN "baseline_km" integer;--> statement-breakpoint
ALTER TABLE "aisha_odometer_readings" ADD COLUMN "service_record_id" uuid;--> statement-breakpoint
ALTER TABLE "aisha_service_records" ADD COLUMN "kuroji_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "aisha_vehicles" ADD COLUMN "kuroji_wallet_id" uuid;--> statement-breakpoint
ALTER TABLE "aisha_vehicles" ADD COLUMN "kuroji_category_id" uuid;--> statement-breakpoint
ALTER TABLE "aisha_odometer_readings" ADD CONSTRAINT "aisha_odometer_readings_service_record_id_aisha_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."aisha_service_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisha_service_records" ADD CONSTRAINT "aisha_service_records_kuroji_transaction_id_transactions_id_fk" FOREIGN KEY ("kuroji_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisha_vehicles" ADD CONSTRAINT "aisha_vehicles_kuroji_wallet_id_accounts_id_fk" FOREIGN KEY ("kuroji_wallet_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisha_vehicles" ADD CONSTRAINT "aisha_vehicles_kuroji_category_id_accounts_id_fk" FOREIGN KEY ("kuroji_category_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aisha_odometer_readings_service_record_id_idx" ON "aisha_odometer_readings" USING btree ("service_record_id");