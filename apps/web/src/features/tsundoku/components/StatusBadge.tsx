import { type BookStatus, STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import { cn } from "@seikatsu/ui";

export function StatusBadge({ status, short }: { status: BookStatus; short?: boolean }) {
	const cfg = STATUS_CONFIG[status];
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
				cfg.className,
			)}
		>
			{short ? cfg.short : cfg.label}
		</span>
	);
}
