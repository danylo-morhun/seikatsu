import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Offline — seikatsu",
};

// Precached by the service worker and served for pages it never saw while online.
// Plain links: a full load lets the worker answer from its page cache.
export default function OfflinePage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
			<span className="text-4xl font-bold text-primary">生</span>
			<h1 className="text-lg font-semibold">You're offline</h1>
			<p className="max-w-xs text-sm text-muted-foreground">
				This page wasn't saved for offline use yet. Pages you opened before still work.
			</p>
			<a
				href="/"
				className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				Back to home
			</a>
		</main>
	);
}
