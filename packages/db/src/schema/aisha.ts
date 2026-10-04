import { relations } from "drizzle-orm";
import {
	date,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

export const aishaFuelTypeEnum = pgEnum("aisha_fuel_type", [
	"petrol",
	"diesel",
	"lpg",
	"hybrid",
	"electric",
]);

export const aishaTransmissionEnum = pgEnum("aisha_transmission", [
	"manual",
	"automatic",
	"dct",
	"unknown",
]);

export const aishaDocumentTypeEnum = pgEnum("aisha_document_type", [
	"insurance",
	"inspection",
	"other",
]);

export const aishaVehicles = pgTable(
	"aisha_vehicles",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		make: text("make").notNull(),
		model: text("model").notNull(),
		year: integer("year").notNull(),
		engine: text("engine"),
		fuelType: aishaFuelTypeEnum("fuel_type").notNull(),
		transmission: aishaTransmissionEnum("transmission").notNull().default("unknown"),
		plate: text("plate"),
		vin: text("vin"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("aisha_vehicles_workspace_id_idx").on(t.workspaceId)],
);

export const aishaOdometerReadings = pgTable(
	"aisha_odometer_readings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => aishaVehicles.id, { onDelete: "cascade" }),
		date: date("date").notNull(),
		km: integer("km").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("aisha_odometer_readings_vehicle_id_idx").on(t.vehicleId)],
);

/** A recurring maintenance task. Due when either interval runs out, whichever comes first. */
export const aishaMaintenanceItems = pgTable(
	"aisha_maintenance_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => aishaVehicles.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		intervalKm: integer("interval_km"),
		intervalMonths: integer("interval_months"),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("aisha_maintenance_items_vehicle_id_idx").on(t.vehicleId)],
);

/** One garage visit. Covers one or more maintenance items via aishaServiceRecordItems. */
export const aishaServiceRecords = pgTable(
	"aisha_service_records",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => aishaVehicles.id, { onDelete: "cascade" }),
		date: date("date").notNull(),
		km: integer("km").notNull(),
		cost: numeric("cost", { precision: 12, scale: 2 }),
		currency: text("currency").notNull().default("PLN"),
		shop: text("shop"),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("aisha_service_records_vehicle_id_idx").on(t.vehicleId)],
);

export const aishaServiceRecordItems = pgTable(
	"aisha_service_record_items",
	{
		recordId: uuid("record_id")
			.notNull()
			.references(() => aishaServiceRecords.id, { onDelete: "cascade" }),
		itemId: uuid("item_id")
			.notNull()
			.references(() => aishaMaintenanceItems.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({ columns: [t.recordId, t.itemId] }),
		index("aisha_service_record_items_item_id_idx").on(t.itemId),
	],
);

/** Date-bound paperwork: OC insurance, technical inspection (przegląd), etc. */
export const aishaDocuments = pgTable(
	"aisha_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => aishaVehicles.id, { onDelete: "cascade" }),
		type: aishaDocumentTypeEnum("type").notNull(),
		name: text("name").notNull(),
		expiresOn: date("expires_on").notNull(),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("aisha_documents_vehicle_id_idx").on(t.vehicleId)],
);

export const aishaVehiclesRelations = relations(aishaVehicles, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [aishaVehicles.workspaceId],
		references: [workspaces.id],
	}),
	readings: many(aishaOdometerReadings),
	items: many(aishaMaintenanceItems),
	services: many(aishaServiceRecords),
	documents: many(aishaDocuments),
}));

export const aishaOdometerReadingsRelations = relations(aishaOdometerReadings, ({ one }) => ({
	vehicle: one(aishaVehicles, {
		fields: [aishaOdometerReadings.vehicleId],
		references: [aishaVehicles.id],
	}),
}));

export const aishaMaintenanceItemsRelations = relations(aishaMaintenanceItems, ({ one, many }) => ({
	vehicle: one(aishaVehicles, {
		fields: [aishaMaintenanceItems.vehicleId],
		references: [aishaVehicles.id],
	}),
	serviceLinks: many(aishaServiceRecordItems),
}));

export const aishaServiceRecordsRelations = relations(aishaServiceRecords, ({ one, many }) => ({
	vehicle: one(aishaVehicles, {
		fields: [aishaServiceRecords.vehicleId],
		references: [aishaVehicles.id],
	}),
	itemLinks: many(aishaServiceRecordItems),
}));

export const aishaServiceRecordItemsRelations = relations(aishaServiceRecordItems, ({ one }) => ({
	record: one(aishaServiceRecords, {
		fields: [aishaServiceRecordItems.recordId],
		references: [aishaServiceRecords.id],
	}),
	item: one(aishaMaintenanceItems, {
		fields: [aishaServiceRecordItems.itemId],
		references: [aishaMaintenanceItems.id],
	}),
}));

export const aishaDocumentsRelations = relations(aishaDocuments, ({ one }) => ({
	vehicle: one(aishaVehicles, {
		fields: [aishaDocuments.vehicleId],
		references: [aishaVehicles.id],
	}),
}));
