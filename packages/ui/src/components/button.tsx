import { Slot as SlotPrimitive } from "radix-ui";

const Slot = SlotPrimitive.Root;

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
	{
		variants: {
			variant: {
				// Hover is one step of the button's own colour, never a see-through wash of it.
				default:
					"bg-primary text-primary-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]",
				destructive:
					"bg-destructive text-white shadow-xs hover:bg-[color-mix(in_oklch,var(--destructive),black_10%)]",
				outline:
					"border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
				secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
				// A trigger whose menu is open keeps its pressed look.
				ghost:
					"hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline active:scale-100",
			},
			size: {
				// A glyph reads as further in than words: its side gets the smaller inset.
				default: "h-10 px-4 py-2 md:h-9 has-[>svg:first-child]:pl-3 has-[>svg:last-child]:pr-3",
				sm: "h-8 rounded-button px-3 text-xs has-[>svg:first-child]:pl-2.5 has-[>svg:last-child]:pr-2.5",
				lg: "h-11 rounded-button px-8",
				icon: "size-10 md:size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
