"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "../lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * The active tab's surface is one shared chip that slides between triggers, so switching
 * reads as moving, not as one tab going dark and another lighting up.
 */
const TabsList = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
	const listRef = React.useRef<HTMLDivElement>(null);
	React.useImperativeHandle(ref, () => listRef.current as HTMLDivElement);
	const [chip, setChip] = React.useState<{ x: number; w: number; moved: boolean } | null>(null);

	React.useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return;
		function place() {
			const active = list?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
			if (!active) {
				setChip(null);
				return;
			}
			const next = { x: active.offsetLeft, w: active.offsetWidth };
			// The first placement lands without sliding; only later moves animate.
			setChip((prev) =>
				prev && prev.x === next.x && prev.w === next.w ? prev : { ...next, moved: prev !== null },
			);
		}
		place();
		const mutations = new MutationObserver(place);
		mutations.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
		const resize = new ResizeObserver(place);
		resize.observe(list);
		return () => {
			mutations.disconnect();
			resize.disconnect();
		};
	}, []);

	return (
		<TabsPrimitive.List
			ref={listRef}
			className={cn(
				"bg-muted text-muted-foreground relative inline-flex h-9 items-center justify-center rounded-lg p-1",
				className,
			)}
			{...props}
		>
			{chip && (
				<span
					aria-hidden
					className={cn(
						"bg-background pointer-events-none absolute inset-y-1 left-0 rounded-md shadow",
						chip.moved &&
							"transition-[translate,width] duration-250 ease-in-out motion-reduce:transition-none",
					)}
					style={{ width: chip.w, translate: `${chip.x}px 0` }}
				/>
			)}
			{children}
		</TabsPrimitive.List>
	);
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			"ring-offset-background focus-visible:ring-ring data-[state=active]:text-foreground relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
			className,
		)}
		{...props}
	/>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content
		ref={ref}
		className={cn(
			"ring-offset-background focus-visible:ring-ring mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
			className,
		)}
		{...props}
	/>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
