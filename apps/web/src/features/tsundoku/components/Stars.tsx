import { StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";

/** 1–10 as stars in halves: 7 → "3½". */
export function formatStars(rating: number): string {
	const whole = Math.floor(rating / 2);
	return rating % 2 ? `${whole || ""}½` : String(whole);
}

export function Star({ fill, className }: { fill: 0 | 0.5 | 1; className?: string }) {
	return (
		<span aria-hidden className={cn("relative block", className)}>
			<HugeiconsIcon icon={StarIcon} className="size-full text-muted-foreground/40" />
			{fill > 0 && (
				<HugeiconsIcon
					icon={StarIcon}
					className={cn(
						"absolute inset-0 size-full text-primary [&_*]:fill-current",
						fill === 0.5 && "[clip-path:inset(0_50%_0_0)]",
					)}
				/>
			)}
		</span>
	);
}

export const fillOf = (value: number, star: number) =>
	(value >= star * 2 ? 1 : value === star * 2 - 1 ? 0.5 : 0) as 0 | 0.5 | 1;

/** The stars alone, small, for tiles and rows (read-only). */
export function Stars({ rating, className }: { rating: number; className?: string }) {
	return (
		<span
			role="img"
			aria-label={`${formatStars(rating)} of 5 stars`}
			className={cn("inline-flex gap-px", className)}
		>
			{[1, 2, 3, 4, 5].map((s) => (
				<Star key={s} fill={fillOf(rating, s)} className="size-3" />
			))}
		</span>
	);
}
