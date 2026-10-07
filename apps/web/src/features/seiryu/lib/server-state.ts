"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Local copy of server data that the UI can change optimistically.
 *
 * Fresh props (the re-render a server action's revalidatePath sends back) replace the
 * local copy, but only while no tracked mutation is in flight. Otherwise the response of
 * the first of two quick moves would snap the second one back until its own response.
 * Server actions resolve before their re-render commits, so the last response always
 * lands with nothing pending and wins.
 */
export function useServerState<T>(server: T) {
	const [state, setState] = useState(server);
	const pending = useRef(0);
	const latest = useRef(server);

	useEffect(() => {
		latest.current = server;
		if (pending.current === 0) setState(server);
	}, [server]);

	/**
	 * Keeps fresh props out until the returned release() is called (e.g. during a drag).
	 * release(true) also shows props that arrived meanwhile — for when no mutation follows.
	 */
	const hold = useCallback(() => {
		pending.current++;
		let released = false;
		return (sync = false) => {
			if (released) return;
			released = true;
			pending.current--;
			if (sync && pending.current === 0) setState(latest.current);
		};
	}, []);

	/** Runs a mutation; while it is pending, fresh props don't overwrite local state. */
	const track = useCallback(
		async <R>(mutation: Promise<R>): Promise<R> => {
			const release = hold();
			try {
				return await mutation;
			} finally {
				release();
			}
		},
		[hold],
	);

	/** Drops local changes and shows the last server data (e.g. after a failed mutation). */
	const reset = useCallback(() => setState(latest.current), []);

	return { state, setState, hold, track, reset };
}
