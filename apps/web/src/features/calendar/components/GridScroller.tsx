"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";

/**
 * The hour grid's scroll box: the whole day is there, and it opens scrolled to where the day
 * starts (or its first timed row), as a calendar does. Its head stays put while the hours move.
 */
export function GridScroller({ top, children }: { top: number; children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		if (ref.current) ref.current.scrollTop = top;
	}, [top]);
	return (
		<div
			ref={ref}
			className="max-h-[calc(100dvh-13rem)] min-h-96 overflow-y-auto overscroll-contain [scrollbar-color:var(--rule)_transparent] [scrollbar-width:thin]"
		>
			{children}
		</div>
	);
}
