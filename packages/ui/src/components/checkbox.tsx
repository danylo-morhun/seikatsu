"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import type * as React from "react";
import { cn } from "../lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out outline-none active:scale-90 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator className="flex items-center justify-center text-current transition-none">
				<svg
					viewBox="0 0 12 12"
					className="size-3.5"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					{/* The tick is drawn on, like a pen stroke, each time it appears. */}
					<path
						d="M2 6l3 3 5-5"
						pathLength={1}
						className="[stroke-dasharray:1] animate-[check-draw_220ms_var(--ease-out)_backwards] motion-reduce:animate-none"
					/>
				</svg>
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
