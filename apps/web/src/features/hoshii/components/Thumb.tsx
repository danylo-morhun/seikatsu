"use client";

import { ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { useState } from "react";

/**
 * A want's photo on a fixed frame: it fades in over a quiet bag, and a broken link keeps
 * the bag. Shop photos are product shots on white, so they sit contained, not cropped.
 */
export function Thumb({
	src,
	className,
	iconClassName,
	priority = false,
}: {
	src: string | null;
	className?: string;
	iconClassName?: string;
	priority?: boolean;
}) {
	const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
	const showImage = src && state !== "failed";
	return (
		<div
			className={cn(
				"relative grid place-items-center overflow-hidden rounded-[10px] bg-surface-2 text-muted-foreground",
				showImage && state === "loaded" && "bg-white",
				className,
			)}
		>
			{(!showImage || state === "loading") && (
				<HugeiconsIcon
					icon={ShoppingBag01Icon}
					aria-hidden
					className={cn("size-1/2 max-h-8 max-w-8 opacity-70", iconClassName)}
				/>
			)}
			{showImage && (
				<img
					key={src}
					src={src}
					ref={(img) => {
						// Already in the cache: onLoad fired before hydration.
						if (img?.complete && img.naturalWidth > 0 && state === "loading") setState("loaded");
					}}
					alt=""
					loading={priority ? "eager" : "lazy"}
					decoding="async"
					referrerPolicy="no-referrer"
					onLoad={() => setState("loaded")}
					onError={() => setState("failed")}
					className={cn(
						"absolute inset-0 size-full object-contain p-[8%] transition-opacity duration-200 ease-out",
						state === "loaded" ? "opacity-100" : "opacity-0",
					)}
				/>
			)}
		</div>
	);
}
