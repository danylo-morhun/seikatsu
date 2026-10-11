"use client";

import { cn } from "@seikatsu/ui";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Glides to its content's height instead of jumping, e.g. when a form's mode swaps its
 * fields. A 4px gutter (padding inside, negative margin outside) keeps focus rings from
 * being clipped. Off below `sm`, where dialogs fill the screen and never resize.
 */
export function AutoHeight({
	children,
	className,
}: { children: React.ReactNode; className?: string }) {
	const innerRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState<number | null>(null);
	// The first measurement lands without animating; later changes glide.
	const [ready, setReady] = useState(false);

	useLayoutEffect(() => {
		const inner = innerRef.current;
		if (!inner) return;
		setHeight(inner.offsetHeight);
		const observer = new ResizeObserver(() => setHeight(inner.offsetHeight));
		observer.observe(inner);
		const frame = requestAnimationFrame(() => setReady(true));
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, []);

	return (
		<div
			className={cn(
				"-m-1 overflow-hidden p-1 max-sm:h-auto!",
				ready && "transition-[height] duration-300 ease-out motion-reduce:transition-none",
			)}
			style={height === null ? undefined : { height: height + 8 }}
		>
			<div ref={innerRef} className={className}>
				{children}
			</div>
		</div>
	);
}
