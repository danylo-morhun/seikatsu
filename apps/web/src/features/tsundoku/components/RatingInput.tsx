"use client";

import { RATING_MAX } from "@/features/tsundoku/lib/constants";
import { StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { useState } from "react";

interface Props {
	value: number | null;
	onChange?: (value: number | null) => void;
	readOnly?: boolean;
	size?: "sm" | "md";
}

/** 10-point star rating. Click a filled star again to clear. */
export function RatingInput({ value, onChange, readOnly = false, size = "md" }: Props) {
	const [hover, setHover] = useState<number | null>(null);
	const active = hover ?? value ?? 0;
	const star = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

	return (
		<div className="flex items-center gap-0.5">
			{Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
				<button
					key={n}
					type="button"
					disabled={readOnly}
					onMouseEnter={() => !readOnly && setHover(n)}
					onMouseLeave={() => !readOnly && setHover(null)}
					onClick={() => onChange?.(value === n ? null : n)}
					className={cn("transition-colors", readOnly ? "cursor-default" : "cursor-pointer")}
					aria-label={`Rate ${n}`}
				>
					<HugeiconsIcon
						icon={StarIcon}
						className={cn(
							star,
							n <= active ? "text-amber-400 [&_*]:fill-amber-400" : "text-muted-foreground/30",
						)}
					/>
				</button>
			))}
			{value != null && (
				<span className="ml-1.5 text-sm font-medium tabular-nums">
					{value}
					<span className="text-muted-foreground">/{RATING_MAX}</span>
				</span>
			)}
		</div>
	);
}
