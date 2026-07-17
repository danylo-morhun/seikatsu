import { cn } from "@seikatsu/ui";
import type { KyuuFilterStatus } from "../lib/kyuu-schemas";

const STATUS_CONFIG: Record<KyuuFilterStatus, { label: string; className: string }> = {
	applied: {
		label: "Applied",
		className: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
	},
	ignored: {
		label: "Ignored",
		className: "border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-400",
	},
	hr_screening: {
		label: "HR Screening",
		className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
	},
	technical_interview: {
		label: "Technical Interview",
		className: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
	},
	offer: {
		label: "Offer",
		className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	},
	rejected: {
		label: "Rejected",
		className: "border-destructive/30 bg-destructive/10 text-destructive",
	},
	withdrawn: {
		label: "Withdrawn",
		className: "border-muted-foreground/30 bg-muted text-muted-foreground",
	},
};

export function StatusBadge({ status }: { status: KyuuFilterStatus }) {
	const config = STATUS_CONFIG[status];
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
				config.className,
			)}
		>
			{config.label}
		</span>
	);
}

export { STATUS_CONFIG };
