import type { CSSProperties } from "react";

/**
 * A bar fill spans the full track and is clipped to its value (see `.bar-fill` in globals.css):
 * it pours in from empty when it appears and glides when the value changes.
 */
export const BAR_FILL = "bar-fill";

/** The fill's value as a 0–1 `ratio`; `index` cascades the pour across a list of bars. */
export function barClip(ratio: number, index = 0): CSSProperties {
	const shown = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0;
	return { "--fill": `${shown * 100}%`, "--i": index } as CSSProperties;
}
