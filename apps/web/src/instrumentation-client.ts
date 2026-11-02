import { loadSentry } from "@/lib/sentry-browser";

type Capture = typeof import("@sentry/nextjs").captureRouterTransitionStart;
let captureTransition: Capture | undefined;

const start = () => {
	loadSentry()?.then((Sentry) => {
		captureTransition = Sentry.captureRouterTransitionStart;
	});
};
if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 3000 });
else setTimeout(start, 1000);

export const onRouterTransitionStart: Capture = (...args) => captureTransition?.(...args);
