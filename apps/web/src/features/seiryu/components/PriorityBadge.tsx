import { PRIORITY_CONFIG, type Priority } from "@/features/seiryu/lib/constants";
import { cn } from "@seikatsu/ui";

interface Props {
	priority: Priority;
	showLabel?: boolean;
	className?: string;
}

/** Four signal bars, filled up to the priority: importance by scale, never by colour. */
export function PriorityBadge({ priority, showLabel = false, className }: Props) {
	const { label, level } = PRIORITY_CONFIG[priority];
	return (
		<span
			className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
		>
			<span aria-hidden className="flex h-3 items-end gap-px">
				{[1, 2, 3, 4].map((bar) => (
					<span
						key={bar}
						className={cn(
							"w-[3px] rounded-[1px]",
							bar <= level ? "bg-foreground/80" : "bg-foreground/15",
						)}
						style={{ height: `${3 + bar * 2}px` }}
					/>
				))}
			</span>
			<span className={cn(!showLabel && "sr-only")}>{label}</span>
		</span>
	);
}
