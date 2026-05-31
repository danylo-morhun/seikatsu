import { PRIORITY_CONFIG } from "@/features/tasso/lib/constants";
import { cn } from "@ethos/ui";

type Priority = "low" | "medium" | "high" | "urgent";

interface Props {
	priority: Priority;
	showLabel?: boolean;
	className?: string;
}

export function PriorityBadge({ priority, showLabel = false, className }: Props) {
	const config = PRIORITY_CONFIG[priority];
	return (
		<span className={cn("inline-flex items-center gap-1", className)}>
			<span className={cn("h-2 w-2 shrink-0 rounded-full", config.color)} />
			{showLabel && <span className="text-xs text-muted-foreground">{config.label}</span>}
		</span>
	);
}
