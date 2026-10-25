// Read-side queries for aisha. Not a "use server" module, so nothing here is
// callable from the client — import only from RSC pages or server actions.

import type { AishaVehicle } from "@/features/aisha/actions/vehicles";
import type { ChromeData } from "@/features/aisha/components/AishaChrome";
import {
	type DueStatus,
	type MaintenanceDue,
	compareUrgency,
	documentDue,
	kmPerDay,
	maintenanceDue,
} from "@/features/aisha/lib/due";
import { currentKm } from "@/features/aisha/lib/odometer";
import { type Queued, buildQueue } from "@/features/aisha/lib/queue";
import { getCurrentWorkspace } from "@/lib/session";
import {
	aishaDocuments,
	aishaMaintenanceItems,
	aishaOdometerReadings,
	aishaServiceRecordItems,
	aishaServiceRecords,
	aishaVehicles,
	asc,
	db,
	desc,
	eq,
} from "@seikatsu/db";
import { cache } from "react";

export type AishaItem = typeof aishaMaintenanceItems.$inferSelect;
export type AishaDocument = typeof aishaDocuments.$inferSelect;
export type AishaService = typeof aishaServiceRecords.$inferSelect;
export type AishaReading = { id: string; date: string; km: number; serviceRecordId: string | null };

export type LastDone = { date: string; km: number; source: "service" | "baseline" };
export type ItemWithDue = AishaItem & { due: MaintenanceDue; lastDone: LastDone | null };
export type DocumentWithDue = AishaDocument & { daysLeft: number; status: DueStatus };
export type ServiceWithItems = AishaService & { items: { id: string; name: string }[] };

export type QueueEntry =
	| { kind: "item"; item: ItemWithDue }
	| { kind: "document"; doc: DocumentWithDue };

/** The car of the current workspace (one for now; the schema already allows more). */
export const getCurrentVehicle = cache(async (): Promise<AishaVehicle | null> => {
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [vehicle] = await db
		.select()
		.from(aishaVehicles)
		.where(eq(aishaVehicles.workspaceId, ws.id))
		.orderBy(asc(aishaVehicles.createdAt))
		.limit(1);
	return vehicle ?? null;
});

export async function getReadings(vehicleId: string): Promise<AishaReading[]> {
	return db
		.select({
			id: aishaOdometerReadings.id,
			date: aishaOdometerReadings.date,
			km: aishaOdometerReadings.km,
			serviceRecordId: aishaOdometerReadings.serviceRecordId,
		})
		.from(aishaOdometerReadings)
		.where(eq(aishaOdometerReadings.vehicleId, vehicleId))
		.orderBy(asc(aishaOdometerReadings.date), asc(aishaOdometerReadings.km));
}

/** Everything about the car. `vehicle` must already be the current user's (getCurrentVehicle). */
export async function getCar(vehicle: AishaVehicle, today: string) {
	const vehicleId = vehicle.id;

	const [readings, items, services, links, documents] = await Promise.all([
		getReadings(vehicleId),
		db
			.select()
			.from(aishaMaintenanceItems)
			.where(eq(aishaMaintenanceItems.vehicleId, vehicleId))
			.orderBy(asc(aishaMaintenanceItems.createdAt)),
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
	const lastServiceByItem = new Map<string, { date: string; km: number }>();
	for (const s of services) {
		for (const itemId of itemIdsByRecord.get(s.id) ?? []) {
			if (!lastServiceByItem.has(itemId)) lastServiceByItem.set(itemId, { date: s.date, km: s.km });
		}
	}

	const itemsWithDue: ItemWithDue[] = items.map((item) => {
		const lastDone = lastDoneOf(item, lastServiceByItem.get(item.id));
		const due = maintenanceDue({
			intervalKm: item.intervalKm,
			intervalMonths: item.intervalMonths,
			lastDone,
			currentKm: km,
			today,
			kmPerDay: pace,
		});
		return { ...item, lastDone, due };
	});

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

	const queue = buildQueue<QueueEntry>([
		...itemsWithDue.map(
			(item): Queued<QueueEntry> => ({
				status: item.due.status,
				when: item.due.estimatedDate,
				entry: { kind: "item", item },
			}),
		),
		...documentsWithDue.map(
			(doc): Queued<QueueEntry> => ({
				status: doc.status,
				when: doc.expiresOn,
				entry: { kind: "document", doc },
			}),
		),
	]);

	return {
		vehicle,
		currentKm: km,
		kmPerDay: pace,
		/** The reading the car was added with: what "done at purchase" counts from. */
		firstReading: readings[0] ?? null,
		readings,
		items: [...itemsWithDue].sort(
			(a, b) => compareUrgency(a.due, b.due) || a.name.localeCompare(b.name),
		),
		documents: documentsWithDue,
		services: servicesWithItems,
		queue,
	};
}

/** The latest logged service, else the baseline set by hand — whichever Aisha has. */
function lastDoneOf(item: AishaItem, service?: { date: string; km: number }): LastDone | null {
	if (service) return { ...service, source: "service" };
	if (item.baselineDate && item.baselineKm != null) {
		return { date: item.baselineDate, km: item.baselineKm, source: "baseline" };
	}
	return null;
}

export type AishaCar = Awaited<ReturnType<typeof getCar>>;

/** What the app's chrome needs to log a service or a reading from any page. */
export async function getChromeData(): Promise<ChromeData | null> {
	const vehicle = await getCurrentVehicle();
	if (!vehicle) return null;
	const [readings, items] = await Promise.all([
		getReadings(vehicle.id),
		db
			.select({ id: aishaMaintenanceItems.id, name: aishaMaintenanceItems.name })
			.from(aishaMaintenanceItems)
			.where(eq(aishaMaintenanceItems.vehicleId, vehicle.id))
			.orderBy(asc(aishaMaintenanceItems.name)),
	]);
	return {
		vehicleId: vehicle.id,
		workspaceId: vehicle.workspaceId,
		currentKm: currentKm(readings),
		items,
		kurojiDefaults: { walletId: vehicle.kurojiWalletId, categoryId: vehicle.kurojiCategoryId },
	};
}
