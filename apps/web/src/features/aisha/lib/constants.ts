import type { DueStatus } from "./due";

export const FUEL_TYPES = ["petrol", "diesel", "lpg", "hybrid", "electric"] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const FUEL_LABELS: Record<FuelType, string> = {
	petrol: "Petrol",
	diesel: "Diesel",
	lpg: "LPG",
	hybrid: "Hybrid",
	electric: "Electric",
};

export const TRANSMISSIONS = ["manual", "automatic", "dct", "unknown"] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
	manual: "Manual",
	automatic: "Automatic (torque converter)",
	dct: "Robot (DCT, dual clutch)",
	unknown: "Not sure",
};

export const DOCUMENT_TYPES = ["insurance", "inspection", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
	insurance: "Insurance",
	inspection: "Technical inspection",
	other: "Other",
};

export const STATUS_LABELS: Record<DueStatus, string> = {
	overdue: "Overdue",
	soon: "Due soon",
	ok: "OK",
	unknown: "No record",
};

export interface MaintenancePreset {
	name: string;
	intervalKm: number | null;
	intervalMonths: number | null;
	note?: string;
	fuel?: FuelType[];
}

// Conservative intervals for a used car driven in mixed/city conditions.
// The owner's manual for the exact model always wins — every item is editable.
export const MAINTENANCE_PRESETS: MaintenancePreset[] = [
	{
		name: "Engine oil + oil filter",
		intervalKm: 10_000,
		intervalMonths: 12,
		note: "Most important item. Check the level on the dipstick monthly.",
		fuel: ["petrol", "diesel", "lpg", "hybrid"],
	},
	{
		name: "Air filter",
		intervalKm: 30_000,
		intervalMonths: 24,
		fuel: ["petrol", "diesel", "lpg", "hybrid"],
	},
	{ name: "Cabin filter", intervalKm: 15_000, intervalMonths: 12 },
	{
		name: "Fuel filter",
		intervalKm: 30_000,
		intervalMonths: 24,
		note: "Critical on diesels — water or dirt here damages the injectors.",
		fuel: ["diesel"],
	},
	{
		name: "Spark plugs",
		intervalKm: 60_000,
		intervalMonths: 48,
		fuel: ["petrol", "lpg", "hybrid"],
	},
	{ name: "LPG filters", intervalKm: 15_000, intervalMonths: 12, fuel: ["lpg"] },
	{ name: "Brake fluid", intervalKm: null, intervalMonths: 24 },
	{
		name: "Coolant",
		intervalKm: 60_000,
		intervalMonths: 48,
		fuel: ["petrol", "diesel", "lpg", "hybrid"],
	},
	{
		name: "Transmission fluid",
		intervalKm: 60_000,
		intervalMonths: 48,
		note: "Interval depends on the gearbox type — confirm with the service.",
	},
	{ name: "Brake pads & discs check", intervalKm: 15_000, intervalMonths: 12 },
	{ name: "Air conditioning service", intervalKm: null, intervalMonths: 24 },
	{ name: "Wiper blades", intervalKm: null, intervalMonths: 12 },
	{ name: "Battery check", intervalKm: null, intervalMonths: 12 },
];

export function presetsFor(fuel: FuelType): MaintenancePreset[] {
	return MAINTENANCE_PRESETS.filter((p) => !p.fuel || p.fuel.includes(fuel));
}

export const CURRENCY = "PLN";
