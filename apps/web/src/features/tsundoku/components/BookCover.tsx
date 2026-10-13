"use client";

import { Book01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Image from "next/image";
import { useState } from "react";

interface Props {
	coverUrl: string | null;
	title: string;
	className?: string;
	/** Above the fold (the book page): load at once instead of lazily. */
	priority?: boolean;
	/** Rendered width, so the optimizer sends a small file. Covers top out near 9rem. */
	sizes?: string;
	/** Throwaway previews (search results): load straight from the source. */
	unoptimized?: boolean;
}

/**
 * A cover on a fixed 2:3 frame, so nothing shifts while it loads: the image fades in over a
 * quiet placeholder (the title, set small), and a broken link keeps the placeholder.
 * Covers come from shops and Open Library at full size (often 300–500 KB), so they go
 * through the image optimizer: resized, WebP/AVIF, cached on the CDN.
 */
export function BookCover({
	coverUrl,
	title,
	className,
	priority = false,
	sizes = "160px",
	unoptimized = false,
}: Props) {
	const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
	const showImage = coverUrl && state !== "failed";

	return (
		<div
			className={cn(
				"relative aspect-[2/3] w-full overflow-hidden rounded-md bg-surface-2 ring-1 ring-rule ring-inset",
				className,
			)}
		>
			{state !== "loaded" && (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-muted-foreground">
					<HugeiconsIcon icon={Book01Icon} aria-hidden className="size-5 opacity-50" />
					<span className="line-clamp-3 text-[11px] leading-tight break-words">{title}</span>
				</div>
			)}
			{showImage && (
				<Image
					// A cached image can finish before hydration, when onLoad is already past.
					ref={(img) => {
						if (img?.complete && img.naturalWidth > 0 && state === "loading") setState("loaded");
					}}
					src={coverUrl}
					alt=""
					fill
					sizes={sizes}
					preload={priority}
					loading={priority ? "eager" : "lazy"}
					unoptimized={unoptimized}
					onLoad={() => setState("loaded")}
					onError={() => setState("failed")}
					className={cn(
						"object-cover transition-opacity duration-200 ease-out",
						state === "loaded" ? "opacity-100" : "opacity-0",
					)}
				/>
			)}
		</div>
	);
}
