"use client";

// Client cache for the accounts/tags (and category usage) every Kuroji form needs. Preloaded while idle, served
// instantly when a modal opens, and refreshed in the background on each open
// (stale-while-revalidate) so edits made elsewhere show up without blocking the form.
// The last copy is also kept in localStorage, so the capture form opens offline after a restart.

import { type FormOptions, getFormOptions } from "@/features/kuroji/actions/form-options";
import { useEffect, useSyncExternalStore } from "react";

let cache: { workspaceId: string; data: FormOptions } | null = null;
let inflight: { workspaceId: string; promise: Promise<FormOptions> } | null = null;
/** Fetched from the server during this visit (not just restored from storage). */
let fetched: string | null = null;
const listeners = new Set<() => void>();
const NO_USAGE: FormOptions["categoryUsage"] = {};
const KEY = "seikatsu:kuroji-form-options";

function emit() {
	for (const l of listeners) l();
}

function persist(entry: { workspaceId: string; data: FormOptions }) {
	try {
		window.localStorage.setItem(KEY, JSON.stringify(entry));
	} catch {
		// storage unavailable or full — the in-memory copy still serves this visit
	}
}

/** The saved copy, if it's for this workspace (read once, before the first fetch lands). */
function restore(workspaceId: string) {
	if (cache) return;
	try {
		const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
		if (saved?.workspaceId === workspaceId && saved.data?.accounts) cache = saved;
	} catch {
		// nothing saved
	}
}

export function loadFormOptions(workspaceId: string): Promise<FormOptions> {
	if (inflight?.workspaceId === workspaceId) return inflight.promise;
	const promise = getFormOptions(workspaceId)
		.then((data) => {
			cache = { workspaceId, data };
			fetched = workspaceId;
			persist(cache);
			emit();
			return data;
		})
		.finally(() => {
			if (inflight?.promise === promise) inflight = null;
		});
	inflight = { workspaceId, promise };
	return promise;
}

/** Make a tag created inline visible to every form without waiting for a refetch. */
export function addTagToFormOptions(workspaceId: string, tag: FormOptions["tags"][number]) {
	if (cache?.workspaceId !== workspaceId || cache.data.tags.some((t) => t.id === tag.id)) return;
	cache = { workspaceId, data: { ...cache.data, tags: [...cache.data.tags, tag] } };
	persist(cache);
	emit();
}

/** Warm the cache when the browser is idle (no-op once fetched this visit, or offline). */
export function preloadFormOptions(workspaceId: string) {
	restore(workspaceId);
	if (fetched === workspaceId || inflight?.workspaceId === workspaceId || !navigator.onLine) return;
	const run = () => void loadFormOptions(workspaceId).catch(() => {});
	if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 2000 });
	else setTimeout(run, 200);
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Accounts/tags for `workspaceId`; refreshes in the background whenever `active` turns true. */
export function useFormOptions(workspaceId: string, active: boolean) {
	const snapshot = useSyncExternalStore(
		subscribe,
		() => cache,
		() => null,
	);
	useEffect(() => {
		restore(workspaceId);
		emit();
		if (active && navigator.onLine) loadFormOptions(workspaceId).catch(() => {});
	}, [active, workspaceId]);

	const data = snapshot?.workspaceId === workspaceId ? snapshot.data : null;
	return {
		accounts: data?.accounts ?? [],
		tags: data?.tags ?? [],
		categoryUsage: data?.categoryUsage ?? NO_USAGE,
		loading: data === null,
	};
}
