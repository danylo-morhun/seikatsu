"use client";

import type { Indicator } from "@/hooks/useIndicator";
import { cn } from "@seikatsu/ui";

/** The 2px pigment underline under the current tab, gliding when the tab changes. */
export function TravelUnderline({ indicator }: { indicator: Indicator | null }) {
	if (!indicator) return null;
	return (
		<span
			aria-hidden
			className={cn(
				"pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left rounded-full bg-primary",
				indicator.moved &&
					"transition-transform duration-300 ease-in-out motion-reduce:transition-none",
			)}
			style={{ transform: `translateX(${indicator.x}px) scaleX(${indicator.w})` }}
		/>
	);
}
