// Browser side of Web Push: what this device supports and its subscription.

export type PushSupport =
	/** Can subscribe right now. */
	| "ready"
	/** iPhone/iPad Safari: push only works once the app is on the Home Screen. */
	| "needs-install"
	/** The user blocked notifications for the site. */
	| "denied"
	| "unsupported";

export function isIos() {
	return (
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		// iPadOS reports itself as a Mac with touch.
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
	);
}

export function isStandalone() {
	return (
		window.matchMedia("(display-mode: standalone)").matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

export function pushSupport(): PushSupport {
	const capable =
		"serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
	if (isIos() && !isStandalone()) return "needs-install";
	if (!capable) return "unsupported";
	if (Notification.permission === "denied") return "denied";
	return "ready";
}

function urlBase64ToUint8Array(base64: string) {
	const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const raw = window.atob(padded);
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
	if (!("serviceWorker" in navigator)) return null;
	const registration = await navigator.serviceWorker.getRegistration();
	return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission (must run from a tap — iOS requires it) and subscribes this device. */
export async function subscribeDevice(): Promise<PushSubscription> {
	const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	if (!key) throw new Error("Push isn't set up on the server.");
	const permission = await Notification.requestPermission();
	if (permission !== "granted") throw new Error("Notifications weren't allowed.");
	const registration = await navigator.serviceWorker.ready;
	return registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(key),
	});
}
