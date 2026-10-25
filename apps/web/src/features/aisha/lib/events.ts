// Fired by the header, the bottom nav and the queue; Aisha's chrome opens the dialog.

export const LOG_SERVICE_EVENT = "aisha:log-service";
export const MILEAGE_EVENT = "aisha:mileage";

/** Log a service, with these items already ticked. */
export function requestLogService(itemIds: string[] = []) {
	window.dispatchEvent(new CustomEvent(LOG_SERVICE_EVENT, { detail: { itemIds } }));
}

export function requestMileage() {
	window.dispatchEvent(new Event(MILEAGE_EVENT));
}
