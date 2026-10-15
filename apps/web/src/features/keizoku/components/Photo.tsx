"use client";

import { Image01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { useState } from "react";

/**
 * A day's photo, fading in once it loads. A file that won't load (gone, or storage briefly
 * unavailable) keeps a quiet placeholder instead of the browser's broken image.
 */
export function Photo({
	src,
	alt = "",
	className,
}: { src: string; alt?: string; className?: string }) {
	const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
	return (
		<span className={cn("relative block overflow-hidden bg-surface-2", className)}>
			{state === "failed" ? (
				<span
					role="img"
					aria-label={alt ? `${alt} (unavailable)` : "Photo unavailable"}
					className="absolute inset-0 flex items-center justify-center text-muted-foreground"
				>
					<HugeiconsIcon icon={Image01Icon} className="size-4" />
				</span>
			) : (
				<img
					src={src}
					alt={alt}
					loading="lazy"
					decoding="async"
					onLoad={() => setState("loaded")}
					onError={() => setState("failed")}
					className={cn(
						"absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out",
						state === "loaded" ? "opacity-100" : "opacity-0",
					)}
				/>
			)}
		</span>
	);
}
