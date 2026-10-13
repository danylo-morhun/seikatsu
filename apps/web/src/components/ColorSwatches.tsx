"use client";

import { LABEL_COLORS } from "@/lib/pigments";
import { PaintBoardIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";

interface Props {
	value: string | null;
	onChange: (hex: string) => void;
	label: string;
}

const CELL =
	"relative flex aspect-square w-full items-center justify-center rounded-md outline-none transition-transform duration-150 ease-out active:scale-[0.97]";
const ON = "ring-2 ring-foreground/80 ring-offset-2 ring-offset-background";
const FOCUS =
	"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The pigments as an even grid that spans the field, plus a last cell for any colour of
 * one's own (the native picker). Named for screen readers, ticked when on.
 */
export function ColorSwatches({ value, onChange, label }: Props) {
	const current = value?.toLowerCase() ?? null;
	const custom = current && !LABEL_COLORS.some((c) => c.hex === current) ? current : null;

	return (
		<div role="radiogroup" aria-label={label} className="grid grid-cols-7 gap-2">
			{LABEL_COLORS.map(({ name, hex }) => {
				const on = current === hex;
				return (
					<button
						key={hex}
						type="button"
						role="radio"
						aria-checked={on}
						aria-label={name}
						title={name}
						onClick={() => onChange(hex)}
						className={cn(CELL, FOCUS, "text-black/70 hover:brightness-110", on && ON)}
						style={{ backgroundColor: hex }}
					>
						{on && <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={2.5} />}
					</button>
				);
			})}
			<label
				title="Custom colour"
				className={cn(
					CELL,
					"cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
					custom
						? cn("text-black/70", ON)
						: "bg-surface-2 text-muted-foreground hover:text-foreground",
				)}
				style={custom ? { backgroundColor: custom } : undefined}
			>
				<HugeiconsIcon
					icon={custom ? Tick02Icon : PaintBoardIcon}
					className={custom ? "size-3.5" : "size-4"}
					strokeWidth={custom ? 2.5 : 1.5}
				/>
				<input
					type="color"
					role="radio"
					aria-checked={!!custom}
					aria-label="Custom colour"
					value={custom ?? current ?? "#9d9790"}
					onChange={(e) => onChange(e.target.value.toLowerCase())}
					className="absolute inset-0 size-full cursor-pointer opacity-0"
				/>
			</label>
		</div>
	);
}
