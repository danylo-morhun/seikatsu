// Window events between Kyuu's pages and its chrome (KyuuChrome), which owns the capture
// dialog and the delete confirmation for every page.

export const NEW_APPLICATION_EVENT = "kyuu:new-application";
export const DELETE_APPLICATION_EVENT = "kyuu:delete-application";

/** New Application (header button, phone +, N). */
export function requestNewApplication() {
	window.dispatchEvent(new Event(NEW_APPLICATION_EVENT));
}

export interface DeleteRequest {
	id: string;
	company: string;
	/** Where to go once it's gone (the application's own page leaves for the table). */
	afterwards?: string;
}

/** Asks before deleting an application for good. */
export function requestDeleteApplication(request: DeleteRequest) {
	window.dispatchEvent(new CustomEvent(DELETE_APPLICATION_EVENT, { detail: request }));
}
