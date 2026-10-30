"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn("p-3", className)}
			classNames={{
				months: "relative flex flex-col sm:flex-row gap-2",
				month: "flex flex-col gap-4",
				month_caption: "flex h-7 justify-center items-center w-full",
				caption_label: "text-sm font-medium",
				// The nav sits beside the months, not inside the caption: pin it over the caption row.
				nav: "absolute inset-x-0 top-0 flex items-center justify-between",
				button_previous: cn(
					buttonVariants({ variant: "outline" }),
					"z-10 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
				),
				button_next: cn(
					buttonVariants({ variant: "outline" }),
					"z-10 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
				),
				month_grid: "w-full border-collapse",
				weekdays: "flex",
				weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
				week: "flex w-full mt-2",
				day: cn(
					"relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
					props.mode === "range"
						? "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
						: "[&:has([aria-selected])]:rounded-md",
				),
				day_button: cn(
					buttonVariants({ variant: "ghost" }),
					"h-8 w-8 p-0 font-normal aria-selected:opacity-100",
				),
				range_start:
					"rounded-l-md [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
				range_end:
					"rounded-r-md [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
				range_middle: "[&>button]:bg-accent [&>button]:text-accent-foreground",
				selected:
					props.mode === "range"
						? ""
						: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground",
				today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
				outside:
					"text-muted-foreground [&>button]:text-muted-foreground aria-selected:bg-accent/50",
				disabled: "text-muted-foreground opacity-50",
				hidden: "invisible",
				...classNames,
			}}
			components={{
				Chevron: ({ orientation, className }) => (
					<HugeiconsIcon
						icon={orientation === "left" ? ChevronLeftIcon : ChevronRightIcon}
						className={cn("h-4 w-4", className)}
					/>
				),
				...props.components,
			}}
			{...props}
		/>
	);
}

Calendar.displayName = "Calendar";

export { Calendar };
