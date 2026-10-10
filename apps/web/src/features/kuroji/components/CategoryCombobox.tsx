"use client";

import { CategoryList } from "@/features/kuroji/components/CategoryList";
import { categoryGroups } from "@/features/kuroji/lib/category-groups";
import { ChevronDownIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Popover, PopoverContent, PopoverTrigger, cn } from "@seikatsu/ui";
import { type ReactNode, useState } from "react";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";

type Category = { id: string; name: string; parentId: string | null };

type ListProps = {
	value: string;
	onValueChange: (id: string) => void;
	categories: Category[];
	/** Recently used category ids, most recent first. */
	recentIds: string[];
};

interface PickerProps extends ListProps {
	placeholder: string;
	invalid?: boolean;
	id?: string;
	"aria-label"?: string;
}

/**
 * The searchable category list in a popover, opened by `children` (the trigger): recent
 * categories first, then every category under its parent.
 */
export function CategoryPopover({
	value,
	onValueChange,
	categories,
	recentIds,
	open,
	onOpenChange,
	children,
}: ListProps & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
}) {
	return (
		// Modal: the list scrolls and holds focus even inside the capture dialog.
		<Popover modal open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				data-slot="popover-content"
				align="start"
				collisionPadding={8}
				aria-label="Choose a category"
				className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[max(var(--radix-popover-trigger-width),18rem)] max-w-[calc(100vw-1rem)] flex-col p-0 max-sm:max-h-[min(60vh,var(--radix-popover-content-available-height))]"
			>
				<CategoryList
					groupsFor={(query) => categoryGroups(categories, { value, recentIds, query })}
					currentId={value}
					onPick={(o) => {
						onValueChange(o.id);
						onOpenChange(false);
					}}
					searchLabel="Find a category"
					emptyText={() => "No category matches"}
					listClassName="max-h-none"
				/>
			</PopoverContent>
		</Popover>
	);
}

/**
 * A select-sized field that opens the category popover. Built for long category trees where
 * a plain select drags.
 */
export function CategoryCombobox({
	placeholder,
	invalid,
	id,
	"aria-label": ariaLabel,
	...list
}: PickerProps) {
	const [open, setOpen] = useState(false);
	const current = list.categories.find((c) => c.id === list.value);

	return (
		<CategoryPopover {...list} open={open} onOpenChange={setOpen}>
			<button
				type="button"
				id={id}
				aria-label={ariaLabel}
				aria-invalid={invalid || undefined}
				className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
			>
				<span className={cn("flex-1 truncate text-left", !current && "text-muted-foreground")}>
					{current?.name ?? placeholder}
				</span>
				<HugeiconsIcon icon={ChevronDownIcon} className="size-4 shrink-0 opacity-50" />
			</button>
		</CategoryPopover>
	);
}

/** CategoryCombobox bound to a react-hook-form field, with its error below. */
export function CategorySelect({
	control,
	name,
	error,
	...picker
}: Omit<PickerProps, "value" | "onValueChange" | "invalid"> & {
	control: Control<never>;
	name: string;
	error?: string;
}) {
	return (
		<Controller
			control={control as never}
			name={name as never}
			render={({ field }: { field: { onChange: (v: string) => void; value: string } }) => (
				<>
					<CategoryCombobox
						{...picker}
						value={field.value ?? ""}
						onValueChange={field.onChange}
						invalid={!!error}
					/>
					{error && <p className="text-destructive text-[0.8rem]">{error}</p>}
				</>
			)}
		/>
	);
}
