"use client";

import { LABEL_COLORS } from "@/features/seiryu/lib/constants";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";

interface Props {
	value: string | null;
	onChange: (hex: string) => void;
	label: string;
}

/** The pigment marks as a radio group: 32px targets, named for screen readers, ticked when on. */
export function ColorSwatches({ value, onChange, label }: Props) {
	return (
		<div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
			{LABEL_COLORS.map(({ name, hex }) => {
				const on = value?.toLowerCase() === hex;
				return (
					<button
						key={hex}
						type="button"
						role="radio"
						aria-checked={on}
						aria-label={name}
						onClick={() => onChange(hex)}
						className="flex size-8 items-center justify-center rounded-md outline-none transition-transform duration-150 ease-out hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
					>
						<span
							className={cn(
								"flex size-5 items-center justify-center rounded-full text-black/70",
								on && "ring-2 ring-foreground/80 ring-offset-2 ring-offset-background",
							)}
							style={{ backgroundColor: hex }}
						>
							{on && <HugeiconsIcon icon={Tick02Icon} className="size-3" strokeWidth={2.5} />}
						</span>
					</button>
				);
			})}
		</div>
	);
}
