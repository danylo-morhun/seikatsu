"use client";

import { useMemo, useRef } from "react";

/**
 * A new item's form outlives a dismissal: Escape, a click outside or × keep what was typed for
 * the next opening; Cancel and Save start the next one blank. Kept in memory only.
 *
 * Call `keep(isNew)` where the dialog's own close fires (Radix `onOpenChange(false)`), and
 * `resume(isNew)` where an opening resets the form — when it returns true, skip the reset.
 */
export function useKeptDraft() {
	const kept = useRef(false);
	return useMemo(
		() => ({
			keep: (keepable = true) => {
				kept.current = keepable;
			},
			/** Whether a draft is being kept (closed by a dismissal, not yet reopened). */
			isKept: () => kept.current,
			resume: (keepable = true) => {
				const resumed = kept.current && keepable;
				kept.current = false;
				return resumed;
			},
		}),
		[],
	);
}
