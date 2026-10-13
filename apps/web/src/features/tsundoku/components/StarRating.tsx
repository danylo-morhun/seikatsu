"use client";

import { StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { useState } from "react";

/** 1–10 as stars in halves: 7 → "3½". */
export function formatStars(rating: number): string {
	const whole = Math.floor(rating / 2);
	return rating % 2 ? `${whole || ""}½` : String(whole);
}

function Star({ fill, className }: { fill: 0 | 0.5 | 1; className?: string }) {
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

const fillOf = (value: number, star: number) =>
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

interface Props {
	value: number | null;
	onChange: (value: number | null) => void;
	disabled?: boolean;
	id?: string;
	"aria-labelledby"?: string;
}

/**
 * Five stars set in halves (stored 1–10). The pointer previews where it is — the left half of a
 * star is a half — and a click sets it; clicking the set value again clears it. From the
 * keyboard it is a slider: arrows step half a star, 1–5 on the book set whole stars.
 */
export function StarRating({ value, onChange, disabled, id, ...aria }: Props) {
	const [hover, setHover] = useState<number | null>(null);
	const shown = hover ?? value ?? 0;

	function valueAt(e: React.PointerEvent | React.MouseEvent, star: number) {
		const rect = e.currentTarget.getBoundingClientRect();
		return e.clientX - rect.left < rect.width / 2 ? star * 2 - 1 : star * 2;
	}

	function onKeyDown(e: React.KeyboardEvent) {
		const current = value ?? 0;
		const step: Record<string, number> = {
			ArrowRight: 1,
			ArrowUp: 1,
			ArrowLeft: -1,
			ArrowDown: -1,
		};
		let next: number | null | undefined;
		if (e.key in step) next = Math.min(10, Math.max(0, current + (step[e.key] ?? 0)));
		else if (e.key === "Home") next = 1;
		else if (e.key === "End") next = 10;
		else if (e.key === "Backspace" || e.key === "Delete") next = null;
		if (next === undefined) return;
		e.preventDefault();
		e.stopPropagation();
		onChange(next === 0 ? null : next);
	}

	return (
		<div
			id={id}
			role="slider"
			tabIndex={disabled ? -1 : 0}
			aria-valuemin={0}
			aria-valuemax={10}
			aria-valuenow={value ?? 0}
			aria-valuetext={value ? `${formatStars(value)} of 5 stars` : "Not rated"}
			aria-disabled={disabled || undefined}
			onKeyDown={disabled ? undefined : onKeyDown}
			onPointerLeave={() => setHover(null)}
			className="-mx-1 flex h-10 w-fit items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
			{...aria}
		>
			{[1, 2, 3, 4, 5].map((star) => (
				// The slider is the control; the stars are its pointer surface.
				<span
					key={star}
					onPointerMove={(e) =>
						!disabled && e.pointerType === "mouse" && setHover(valueAt(e, star))
					}
					onClick={(e) => {
						if (disabled) return;
						const next = valueAt(e, star);
						setHover(null);
						onChange(next === value ? null : next);
					}}
					className={cn(
						"flex h-10 w-8 items-center justify-center transition-transform duration-150 ease-out",
						disabled ? "cursor-default" : "cursor-pointer active:scale-[0.88]",
					)}
				>
					<Star fill={fillOf(shown, star)} className="size-5" />
				</span>
			))}
			<span className="ml-1.5 w-7 font-figures text-sm text-muted-foreground">
				{shown ? formatStars(shown) : ""}
			</span>
		</div>
	);
}
