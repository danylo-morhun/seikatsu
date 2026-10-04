CREATE TYPE "public"."aisha_document_type" AS ENUM('insurance', 'inspection', 'other');--> statement-breakpoint
CREATE TYPE "public"."aisha_fuel_type" AS ENUM('petrol', 'diesel', 'lpg', 'hybrid', 'electric');--> statement-breakpoint
CREATE TYPE "public"."aisha_transmission" AS ENUM('manual', 'automatic', 'dct', 'unknown');--> statement-breakpoint
CREATE TABLE "aisha_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" "aisha_document_type" NOT NULL,
	"name" text NOT NULL,
	"expires_on" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aisha_maintenance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"name" text NOT NULL,
	"interval_km" integer,
	"interval_months" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aisha_odometer_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"date" date NOT NULL,
	"km" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aisha_service_record_items" (
	"record_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "aisha_service_record_items_record_id_item_id_pk" PRIMARY KEY("record_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "aisha_service_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"date" date NOT NULL,
	"km" integer NOT NULL,
	"cost" numeric(12, 2),
	"currency" text DEFAULT 'PLN' NOT NULL,
	"shop" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aisha_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"engine" text,
	"fuel_type" "aisha_fuel_type" NOT NULL,
	"transmission" "aisha_transmission" DEFAULT 'unknown' NOT NULL,
	"plate" text,
	"vin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aisha_documents" ADD CONSTRAINT "aisha_documents_vehicle_id_aisha_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."aisha_vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisha_maintenance_items" ADD CONSTRAINT "aisha_maintenance_items_vehicle_id_aisha_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."aisha_vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisha_odometer_readings" ADD CONSTRAINT "aisha_odometer_readings_vehicle_id_aisha_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."aisha_vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisha_service_record_items" ADD CONSTRAINT "aisha_service_record_items_record_id_aisha_service_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."aisha_service_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisha_service_record_items" ADD CONSTRAINT "aisha_service_record_items_item_id_aisha_maintenance_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."aisha_maintenance_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisha_service_records" ADD CONSTRAINT "aisha_service_records_vehicle_id_aisha_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."aisha_vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisha_vehicles" ADD CONSTRAINT "aisha_vehicles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aisha_documents_vehicle_id_idx" ON "aisha_documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "aisha_maintenance_items_vehicle_id_idx" ON "aisha_maintenance_items" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "aisha_odometer_readings_vehicle_id_idx" ON "aisha_odometer_readings" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "aisha_service_record_items_item_id_idx" ON "aisha_service_record_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "aisha_service_records_vehicle_id_idx" ON "aisha_service_records" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "aisha_vehicles_workspace_id_idx" ON "aisha_vehicles" USING btree ("workspace_id");