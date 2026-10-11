import { formatShortDate, localToday } from "@/features/kuroji/lib/dates";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";

interface Props {
	dueDate: string;
	/** YYYY-MM-DD in the user's calendar; defaults to the browser's today. */
	today?: string;
	className?: string;
}

/** The due date in Kuroji's date style; late is told in vermilion, due today in ink. */
export function DueDateChip({ dueDate, today = localToday(), className }: Props) {
	const overdue = dueDate < today;
	const dueToday = dueDate === today;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 text-xs tabular-nums",
				overdue ? "text-negative" : dueToday ? "text-foreground" : "text-muted-foreground",
				className,
			)}
		>
			<HugeiconsIcon icon={Calendar03Icon} className="h-3.5 w-3.5" />
			{dueToday ? "Today" : formatShortDate(dueDate, today)}
			{overdue && <span className="sr-only">, overdue</span>}
		</span>
	);
}
