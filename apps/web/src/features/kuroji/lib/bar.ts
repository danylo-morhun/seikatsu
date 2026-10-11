import type { CSSProperties } from "react";

/** A bar fill spans the full track and is clipped to its value, so a new value glides instead of jumping. */
export const BAR_FILL =
	"transition-[clip-path] duration-250 ease-in-out motion-reduce:transition-none";

/** Clips a full-width fill down to `ratio` (0–1), keeping the rounded end. */
export function barClip(ratio: number): CSSProperties {
	const shown = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0;
	return { clipPath: `inset(0 ${100 - shown * 100}% 0 0 round 9999px)` };
}
