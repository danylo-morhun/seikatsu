import { type BookStatus, STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import { cn } from "@seikatsu/ui";

export function StatusBadge({ status, short }: { status: BookStatus; short?: boolean }) {
	const cfg = STATUS_CONFIG[status];
	return (
		<span
			className={cn("text-xs", status === "reading" ? "text-primary" : "text-muted-foreground")}
		>
			{short ? cfg.short : cfg.label}
		</span>
	);
}
