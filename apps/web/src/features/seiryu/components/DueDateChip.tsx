import { cn } from "@seikatsu/ui";

interface Props {
	dueDate: string;
	className?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DueDateChip({ dueDate, className }: Props) {
	const [year, month, day] = dueDate.split("-").map(Number) as [number, number, number];
	const date = new Date(year, (month as number) - 1, day as number);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const isOverdue = date < today;

	const label = `${MONTHS[date.getMonth()]} ${date.getDate()}`;

	return (
		<span
			className={cn(
				"inline-flex items-center rounded px-1 py-0.5 text-xs font-medium",
				isOverdue ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground",
				className,
			)}
		>
			{label}
		</span>
	);
}
