// Read-side queries for aisha. Not a "use server" module, so nothing here is
// callable from the client — import only from RSC pages or server actions.

import type { AishaVehicle } from "@/features/aisha/actions/vehicles";
import {
	type DueStatus,
	type MaintenanceDue,
	compareUrgency,
	documentDue,
	kmPerDay,
	maintenanceDue,
} from "@/features/aisha/lib/due";
import { currentKm } from "@/features/aisha/lib/odometer";
import {
	aishaDocuments,
	aishaMaintenanceItems,
	aishaOdometerReadings,
	aishaServiceRecordItems,
	aishaServiceRecords,
	asc,
	db,
	desc,
	eq,
} from "@seikatsu/db";

export type AishaItem = typeof aishaMaintenanceItems.$inferSelect;
export type AishaDocument = typeof aishaDocuments.$inferSelect;
export type AishaService = typeof aishaServiceRecords.$inferSelect;

export type ItemWithDue = AishaItem & {
	due: MaintenanceDue;
	lastDone: { date: string; km: number } | null;
};
export type DocumentWithDue = AishaDocument & { daysLeft: number; status: DueStatus };
export type ServiceWithItems = AishaService & { items: { id: string; name: string }[] };

export async function getReadings(vehicleId: string) {
	return db
		.select({ date: aishaOdometerReadings.date, km: aishaOdometerReadings.km })
		.from(aishaOdometerReadings)
		.where(eq(aishaOdometerReadings.vehicleId, vehicleId))
		.orderBy(asc(aishaOdometerReadings.date));
}

/** `vehicle` must already be checked against the workspace (the page got it from getVehicles). */
export async function getDashboard(vehicle: AishaVehicle, today: string) {
	const vehicleId = vehicle.id;

	const [readings, items, services, links, documents] = await Promise.all([
		getReadings(vehicleId),
		db.select().from(aishaMaintenanceItems).where(eq(aishaMaintenanceItems.vehicleId, vehicleId)),
		db
			.select()
			.from(aishaServiceRecords)
			.where(eq(aishaServiceRecords.vehicleId, vehicleId))
			.orderBy(desc(aishaServiceRecords.date), desc(aishaServiceRecords.km)),
		db
			.select({
				recordId: aishaServiceRecordItems.recordId,
				itemId: aishaServiceRecordItems.itemId,
			})
			.from(aishaServiceRecordItems)
			.innerJoin(aishaServiceRecords, eq(aishaServiceRecordItems.recordId, aishaServiceRecords.id))
			.where(eq(aishaServiceRecords.vehicleId, vehicleId)),
		db
			.select()
			.from(aishaDocuments)
			.where(eq(aishaDocuments.vehicleId, vehicleId))
			.orderBy(asc(aishaDocuments.expiresOn)),
	]);

	const km = currentKm(readings);
	const pace = kmPerDay(readings);
	const itemById = new Map(items.map((i) => [i.id, i]));

	const itemIdsByRecord = new Map<string, string[]>();
	for (const l of links) {
		const ids = itemIdsByRecord.get(l.recordId);
		if (ids) ids.push(l.itemId);
		else itemIdsByRecord.set(l.recordId, [l.itemId]);
	}

	// services are newest-first, so the first one seen per item is its latest.
	const lastDoneByItem = new Map<string, { date: string; km: number }>();
	for (const s of services) {
		for (const itemId of itemIdsByRecord.get(s.id) ?? []) {
			if (!lastDoneByItem.has(itemId)) lastDoneByItem.set(itemId, { date: s.date, km: s.km });
		}
	}

	const itemsWithDue: ItemWithDue[] = items
		.map((item) => {
			const lastDone = lastDoneByItem.get(item.id) ?? null;
			const due = maintenanceDue({
				intervalKm: item.intervalKm,
				intervalMonths: item.intervalMonths,
				lastDone,
				currentKm: km,
				today,
				kmPerDay: pace,
			});
			return { ...item, lastDone, due };
		})
		.sort((a, b) => compareUrgency(a.due, b.due) || a.name.localeCompare(b.name));

	const documentsWithDue: DocumentWithDue[] = documents.map((d) => ({
		...d,
		...documentDue(d.expiresOn, today),
	}));

	const servicesWithItems: ServiceWithItems[] = services.map((s) => ({
		...s,
		items: (itemIdsByRecord.get(s.id) ?? [])
			.map((id) => itemById.get(id))
			.filter((i): i is AishaItem => i != null)
			.map((i) => ({ id: i.id, name: i.name })),
	}));

	return {
		vehicle,
		currentKm: km,
		kmPerDay: pace,
		items: itemsWithDue,
		documents: documentsWithDue,
		services: servicesWithItems,
	};
}

export type AishaDashboard = NonNullable<Awaited<ReturnType<typeof getDashboard>>>;
