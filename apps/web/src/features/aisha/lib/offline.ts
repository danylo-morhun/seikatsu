// Aisha's offline-capable mutations: run the action or queue it when there's no connection.
// Due dates need every reading and service, so the dashboard updates once they sync.

import { updateDocument } from "@/features/aisha/actions/documents";
import { addReading } from "@/features/aisha/actions/readings";
import { logService } from "@/features/aisha/actions/services";
import type { DocumentFormValues, ServiceFormValues } from "@/features/aisha/lib/aisha-schemas";
import { runOrQueue } from "@/features/pwa/lib/run";

const KM = new Intl.NumberFormat("pl-PL");

/** Its id is made here, so a replay lands once. */
export function saveReading(vehicleId: string, values: { date: string; km: number }) {
	const args = { vehicleId, id: crypto.randomUUID(), ...values };
	return runOrQueue("aisha.addReading", args, `Mileage ${KM.format(values.km)} km`, () =>
		addReading(vehicleId, { id: args.id, ...values }),
	);
}

/** Its id is made here, so a replay lands once. */
export function saveService(vehicleId: string, values: ServiceFormValues) {
	const withId = { ...values, id: crypto.randomUUID() };
	return runOrQueue(
		"aisha.logService",
		{ vehicleId, values: withId },
		`Service at ${KM.format(values.km)} km`,
		() => logService(vehicleId, withId),
	);
}

/** An edit or renewal of a document: the whole document is set, so a replay lands once. */
export function saveDocument(documentId: string, values: DocumentFormValues) {
	return runOrQueue(
		"aisha.updateDocument",
		{ documentId, values },
		`${values.name || "Document"} saved`,
		() => updateDocument(documentId, values),
	);
}

/** The toast for a change kept on this device. */
export { QUEUED_TOAST } from "@/features/pwa/lib/run";
