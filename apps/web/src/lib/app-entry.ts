// Remembers where the user last was inside an app (e.g. the open Seiryu project) so the
// sidebar can link — and prefetch — that page directly instead of a redirecting index.
// Browser storage only; every read/write tolerates it being unavailable.

const KEY = "seikatsu:app-entry";

function readAll(): Record<string, string> {
	try {
		return JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
	} catch {
		return {};
	}
}

export function rememberAppEntry(appHref: string, href: string) {
	try {
		window.localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [appHref]: href }));
	} catch {
		// storage unavailable — the sidebar falls back to the app index
	}
}

export function readAppEntry(appHref: string): string | null {
	const href = readAll()[appHref];
	return typeof href === "string" && href.startsWith(`${appHref}/`) ? href : null;
}
