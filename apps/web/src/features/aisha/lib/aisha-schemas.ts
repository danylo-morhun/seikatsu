import { z } from "zod";
import { DOCUMENT_TYPES, FUEL_TYPES, TRANSMISSIONS } from "./constants";

const optionalText = z
	.string()
	.optional()
	.transform((v) => v?.trim() || undefined);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const km = z.number().int("Whole km only").min(0).max(2_000_000);
const interval = z.number().int().min(1).nullable();

export const vehicleFormSchema = z.object({
	make: z.string().trim().min(1, "Make required").max(50),
	model: z.string().trim().min(1, "Model required").max(50),
	year: z.number().int().min(1950).max(2100),
	engine: optionalText,
	fuelType: z.enum(FUEL_TYPES),
	transmission: z.enum(TRANSMISSIONS),
	plate: optionalText.transform((v) => v?.toUpperCase().replace(/\s+/g, "")),
	vin: optionalText.transform((v) => v?.toUpperCase()),
});
export type VehicleFormValues = z.input<typeof vehicleFormSchema>;

export const createVehicleSchema = vehicleFormSchema.extend({
	currentKm: km,
	today: isoDate,
});
export type CreateVehicleValues = z.input<typeof createVehicleSchema>;

export const readingSchema = z.object({ date: isoDate, km });
export type ReadingValues = z.input<typeof readingSchema>;

export const itemFormSchema = z
	.object({
		name: z.string().trim().min(1, "Name required").max(80),
		intervalKm: interval,
		intervalMonths: interval,
		note: optionalText,
	})
	.refine((v) => v.intervalKm != null || v.intervalMonths != null, {
		message: "Set a km or a month interval",
		path: ["intervalKm"],
	});
export type ItemFormValues = z.input<typeof itemFormSchema>;

export const serviceFormSchema = z.object({
	date: isoDate,
	km,
	itemIds: z.array(z.string().uuid()).min(1, "Pick at least one item"),
	cost: z.number().min(0).max(1_000_000).nullable(),
	shop: optionalText,
	note: optionalText,
});
export type ServiceFormValues = z.input<typeof serviceFormSchema>;

export const documentFormSchema = z.object({
	type: z.enum(DOCUMENT_TYPES),
	name: z.string().trim().min(1, "Name required").max(80),
	expiresOn: isoDate,
	note: optionalText,
});
export type DocumentFormValues = z.input<typeof documentFormSchema>;
