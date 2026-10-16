// Window events between Kyuu's lists and its chrome (KyuuChrome), which owns the one
// application sheet and the capture/edit dialog for every page.

import type { EventKind } from "./stages";

export const NEW_APPLICATION_EVENT = "kyuu:new-application";
export const OPEN_APPLICATION_EVENT = "kyuu:open-application";
export const EDIT_APPLICATION_EVENT = "kyuu:edit-application";
export const LOG_EVENT_EVENT = "kyuu:log-event";

/** New Application (header button, phone +, N). */
export function requestNewApplication() {
	window.dispatchEvent(new Event(NEW_APPLICATION_EVENT));
}

/** Opens an application's sheet. */
export function requestOpenApplication(id: string) {
	window.dispatchEvent(new CustomEvent(OPEN_APPLICATION_EVENT, { detail: { id } }));
}

/** Opens the edit dialog for an application. */
export function requestEditApplication(id: string) {
	window.dispatchEvent(new CustomEvent(EDIT_APPLICATION_EVENT, { detail: { id } }));
}

/** Opens the event dialog: book a screen or interview, or log an answer. */
export function requestLogEvent(id: string, kind: EventKind) {
	window.dispatchEvent(new CustomEvent(LOG_EVENT_EVENT, { detail: { id, kind } }));
}

export const DELETE_APPLICATION_EVENT = "kyuu:delete-application";

/** Asks before deleting an application for good. */
export function requestDeleteApplication(id: string) {
	window.dispatchEvent(new CustomEvent(DELETE_APPLICATION_EVENT, { detail: { id } }));
}
