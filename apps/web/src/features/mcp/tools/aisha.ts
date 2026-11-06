import { z } from "zod";
import { getCar, getCurrentVehicle } from "@/features/aisha/actions/data";
import { addReading } from "@/features/aisha/actions/readings";
import { logService } from "@/features/aisha/actions/services";
import { page } from "@/features/mcp/lib/compact";
import { day } from "./shell";
import { tool } from "./types";

const id = z.uuid();
const NO_CAR = { error: "No car in Aisha yet" };

export const aishaTools = [
	tool({
		name: "aisha_car",
		title: "Aisha car",
		description:
			"The car: odometer now, km per day, and the Next queue — every maintenance item (with id) and document by urgency (overdue / due soon / ok), with last done and when it's next due.",
		input: {},
		run: async (_a, { today }) => {
			const vehicle = await getCurrentVehicle();
			if (!vehicle) return NO_CAR;
			const car = await getCar(vehicle, today);
			return {
				vehicle: car.vehicle,
				currentKm: car.currentKm,
				kmPerDay: car.kmPerDay,
				items: car.items,
				documents: car.documents,
				lastReading: car.readings.at(-1),
			};
		},
	}),
	tool({
		name: "aisha_history",
		title: "Aisha history",
		description:
			"Services (date, km, items done, cost, shop) and odometer readings, newest first, 50 per page.",
		input: { offset: z.number().int().min(0).default(0) },
		run: async ({ offset }, { today }) => {
			const vehicle = await getCurrentVehicle();
			if (!vehicle) return NO_CAR;
			const car = await getCar(vehicle, today);
			return {
				services: page([...car.services].reverse(), offset, 50),
				readings: page([...car.readings].reverse(), offset, 50),
			};
		},
	}),
	tool({
		name: "aisha_log_mileage",
		title: "Log mileage",
		description:
			"Record the odometer (km) on a day (default today). Pass a fresh requestId (uuid) so a retry lands once.",
		input: {
			km: z.number().int().min(0).max(10_000_000),
			date: day.optional(),
			requestId: id.optional(),
		},
		write: true,
		idempotent: true,
		run: async ({ km, date, requestId }, { today }) => {
			const vehicle = await getCurrentVehicle();
			if (!vehicle) return NO_CAR;
			return addReading(vehicle.id, { id: requestId, date: date ?? today, km });
		},
	}),
	tool({
		name: "aisha_log_service",
		title: "Log a service",
		description:
			"Record a service: which maintenance items were done (ids from aisha_car), date, km, cost, shop, note. Optionally also book the cost in Kuroji (walletId = ASSET paid from, categoryId = EXPENSE). Pass a fresh requestId (uuid).",
		input: {
			itemIds: z.array(id).min(1).max(30),
			km: z.number().int().min(0).max(10_000_000),
			date: day.optional(),
			cost: z.number().min(0).max(1_000_000).nullable().default(null),
			shop: z.string().max(200).optional(),
			note: z.string().max(1000).optional(),
			kuroji: z.object({ walletId: id, categoryId: id }).nullable().default(null),
			requestId: id.optional(),
		},
		write: true,
		idempotent: true,
		run: async ({ requestId, date, ...values }, { today }) => {
			const vehicle = await getCurrentVehicle();
			if (!vehicle) return NO_CAR;
			return logService(vehicle.id, { id: requestId, date: date ?? today, ...values });
		},
	}),
];
