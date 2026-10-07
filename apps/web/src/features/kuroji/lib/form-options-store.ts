"use client";

// Client cache for the accounts/tags every Kuroji form needs. Preloaded while idle, served
// instantly when a modal opens, and refreshed in the background on each open
// (stale-while-revalidate) so edits made elsewhere show up without blocking the form.

import { type FormOptions, getFormOptions } from "@/features/kuroji/actions/form-options";
import { useEffect, useSyncExternalStore } from "react";

let cache: { workspaceId: string; data: FormOptions } | null = null;
let inflight: { workspaceId: string; promise: Promise<FormOptions> } | null = null;
const listeners = new Set<() => void>();

function emit() {
	for (const l of listeners) l();
}

export function loadFormOptions(workspaceId: string): Promise<FormOptions> {
	if (inflight?.workspaceId === workspaceId) return inflight.promise;
	const promise = getFormOptions(workspaceId)
		.then((data) => {
			cache = { workspaceId, data };
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
	emit();
}

/** Warm the cache when the browser is idle (no-op if already cached). */
export function preloadFormOptions(workspaceId: string) {
	if (cache?.workspaceId === workspaceId) return;
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
		if (active) loadFormOptions(workspaceId).catch(() => {});
	}, [active, workspaceId]);

	const data = snapshot?.workspaceId === workspaceId ? snapshot.data : null;
	return { accounts: data?.accounts ?? [], tags: data?.tags ?? [], loading: data === null };
}
