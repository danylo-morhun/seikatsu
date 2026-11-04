"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import { useTransition } from "react";
import { toast } from "sonner";
import { QUEUED_TOAST } from "@/features/pwa/lib/run";
import { addDays } from "@/features/seiryu/lib/filters";
import { saveCard } from "@/features/seiryu/lib/offline";

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const name = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));

/**
 * A card's due day, moved from the week: the days left in it, next Monday, or no date — the
 * same change as the card's own date field in Seiryu (offline-capable). Saving refreshes the
 * week, so the card shows up on its new day.
 */
export function MoveCard({
	card,
	from,
	days,
	weekEnd,
}: {
	card: { id: string; title: string };
	from: string;
	/** The other days still ahead this week. */
	days: string[];
	/** The week's Sunday: "Next week" is the Monday after it. */
	weekEnd: string;
}) {
	const [isPending, startTransition] = useTransition();

	function move(to: string | null) {
		startTransition(async () => {
			const result = await saveCard(card.id, card.title, { dueDate: to }).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
			else if ("queued" in result) toast(QUEUED_TOAST);
		});
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="size-8 shrink-0 text-muted-foreground"
					aria-label={`Move ${card.title} to another day`}
					disabled={isPending}
				>
					<HugeiconsIcon icon={Calendar03Icon} className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>Move from {name(from)} to</DropdownMenuLabel>
				{days.map((d) => (
					<DropdownMenuItem key={d} onSelect={() => move(d)}>
						{name(d)}
					</DropdownMenuItem>
				))}
				<DropdownMenuItem onSelect={() => move(addDays(weekEnd, 1))}>Next week</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => move(null)}>No due date</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
