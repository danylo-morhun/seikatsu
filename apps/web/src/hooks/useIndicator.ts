"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

export interface Indicator {
	/** Offset from the container's left edge, in px. */
	x: number;
	/** Width of the target's content box, in px. */
	w: number;
	/** False for the first placement, which should land without travelling. */
	moved: boolean;
}

/**
 * Measures the element matching `selector` inside `container` so one shared indicator
 * (underline, pill) can travel to it. Re-measures whenever `key` changes and on resize.
 * The target's horizontal padding is excluded, so the indicator spans its label.
 */
export function useIndicator(
	container: RefObject<HTMLElement | null>,
	selector: string,
	key: unknown,
): Indicator | null {
	const [indicator, setIndicator] = useState<Indicator | null>(null);

	useLayoutEffect(() => {
		const root = container.current;
		if (!root) return;
		function place() {
			const target = root?.querySelector<HTMLElement>(selector);
			if (!root || !target) {
				setIndicator(null);
				return;
			}
			const style = getComputedStyle(target);
			const padLeft = Number.parseFloat(style.paddingLeft);
			const padRight = Number.parseFloat(style.paddingRight);
			const x =
				target.getBoundingClientRect().left -
				root.getBoundingClientRect().left +
				root.scrollLeft +
				padLeft;
			const w = target.offsetWidth - padLeft - padRight;
			setIndicator((prev) => ({ x, w, moved: prev !== null }));
		}
		place();
		window.addEventListener("resize", place);
		return () => window.removeEventListener("resize", place);
	}, [container, selector, key]);

	return indicator;
}
