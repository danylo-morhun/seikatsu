import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { formatShortDate, localToday } from "@/features/kuroji/lib/dates";

interface Props {
	dueDate: string;
	/** "HH:MM", shown after the day. */
	dueTime?: string | null;
	/** YYYY-MM-DD in the user's calendar; defaults to the browser's today. */
	today?: string;
	className?: string;
}

/** The due date in Kuroji's date style; late is told in vermilion, due today in ink. */
export function DueDateChip({ dueDate, dueTime, today = localToday(), className }: Props) {
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
			<span className="sr-only">Due </span>
			{dueToday ? "Today" : formatShortDate(dueDate, today)}
			{dueTime && ` ${dueTime}`}
			{overdue && <span className="sr-only">, overdue</span>}
		</span>
	);
}
