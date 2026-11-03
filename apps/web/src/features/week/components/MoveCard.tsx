"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { saveCard } from "@/features/seiryu/lib/offline";

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const name = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));

/** A card due this week, moved to another day: its due date changes in Seiryu. */
export function MoveCard({
	card,
	from,
	days,
}: {
	card: { id: string; title: string };
	from: string;
	days: string[];
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	if (days.length === 0) return null;

	function move(to: string) {
		startTransition(async () => {
			const result = await saveCard(card.id, card.title, { dueDate: to }).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			// Seiryu's action refreshes Seiryu's pages; the week reads the card again here.
			router.refresh();
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
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
