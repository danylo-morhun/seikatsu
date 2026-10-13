"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A text field that saves itself: typing edits a local draft, which is committed on blur, on
 * Enter (the caller decides) and when the field unmounts — closing a sheet with Escape never
 * loses what was typed. A fresh `value` from the server replaces the draft unless it is dirty.
 */
export function useDraft(value: string, commit: (next: string) => void) {
	const [draft, setDraft] = useState(value);
	const draftRef = useRef(value);
	const savedRef = useRef(value);
	const commitRef = useRef(commit);
	commitRef.current = commit;

	useEffect(() => {
		if (draftRef.current === savedRef.current) {
			draftRef.current = value;
			setDraft(value);
		}
		savedRef.current = value;
	}, [value]);

	const change = useCallback((next: string) => {
		draftRef.current = next;
		setDraft(next);
	}, []);

	const flush = useCallback(() => {
		if (draftRef.current === savedRef.current) return;
		savedRef.current = draftRef.current;
		commitRef.current(draftRef.current);
	}, []);

	/** Drops the draft back to the last saved value. */
	const revert = useCallback(() => {
		draftRef.current = savedRef.current;
		setDraft(savedRef.current);
	}, []);

	useEffect(() => flush, [flush]);

	return { draft, change, flush, revert };
}
