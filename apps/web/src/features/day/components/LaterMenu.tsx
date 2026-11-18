"use client";

import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import { useRef } from "react";
import { laterDays } from "@/features/day/lib/day";
import { shortDay } from "@/features/day/lib/offline";

/**
 * "Later" for any row of the day: tomorrow, the weekend, next week or a day of its own; a card
 * can also lose its date. The caller does the putting off (lib/offline `putOff`).
 */
export function LaterMenu({
	title,
	today,
	onPick,
	onNoDate,
	compact = false,
	className,
}: {
	title: string;
	today: string;
	onPick: (until: string) => void;
	/** Cards only: "No date". */
	onNoDate?: () => void;
	/** An icon on phones, the word on wider screens. */
	compact?: boolean;
	className?: string;
}) {
	const days = laterDays(today);
	const picker = useRef<HTMLInputElement>(null);
	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={cn("shrink-0 gap-1.5 text-muted-foreground", className)}
						aria-label={`Later: ${title}`}
					>
						<HugeiconsIcon
							icon={Clock01Icon}
							className={cn("size-3.5", compact ? "sm:hidden" : "hidden")}
						/>
						<span className={cn(compact && "max-sm:hidden")}>Later</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-52">
					<DropdownMenuLabel>Put off until</DropdownMenuLabel>
					<DropdownMenuItem onSelect={() => onPick(days.tomorrow)}>
						Tomorrow
						<DropdownMenuShortcut>{shortDay(days.tomorrow).split(" ")[0]}</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => onPick(days.weekend)}>
						The weekend
						<DropdownMenuShortcut>{shortDay(days.weekend)}</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => onPick(days.nextWeek)}>
						Next week
						<DropdownMenuShortcut>{shortDay(days.nextWeek)}</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => {
							// After the menu has closed, so the picker isn't dismissed with it.
							setTimeout(() => picker.current?.showPicker?.(), 0);
						}}
					>
						Pick a day…
					</DropdownMenuItem>
					{onNoDate && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={onNoDate}>No date</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<input
				ref={picker}
				type="date"
				tabIndex={-1}
				aria-hidden
				min={days.tomorrow}
				className="pointer-events-none absolute size-0 opacity-0"
				onChange={(e) => {
					if (e.target.value > today) onPick(e.target.value);
					e.target.value = "";
				}}
			/>
		</>
	);
}
