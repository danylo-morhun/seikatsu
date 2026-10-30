"use client";

import { useRef } from "react";

/**
 * What a dialog shows while it closes. Its subject is usually cleared the moment it closes
 * (`open={target != null}`), but the exit animation still runs: without this the title flips
 * from "Edit" to "New", or reads `Delete ""?`, on the way out.
 */
export function useHeld<T>(value: T, open: boolean): T {
	const held = useRef(value);
	if (open) held.current = value;
	return open ? value : held.current;
}
