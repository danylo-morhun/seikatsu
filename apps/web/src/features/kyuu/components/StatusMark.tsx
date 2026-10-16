import {
	Call02Icon,
	Cancel01Icon,
	DiamondIcon,
	HourglassIcon,
	Logout03Icon,
	Mail01Icon,
	Search01Icon,
	SentIcon,
	StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { STATUS_CONFIG, type Status } from "../lib/stages";

/** Each status: its glyph, and a colour by what it means for the search. */
export const STATUS_LOOK: Record<Status, { icon: typeof SentIcon; className: string }> = {
	sourced: { icon: Search01Icon, className: "text-muted-foreground" },
	drafted: { icon: Mail01Icon, className: "text-orange-600 dark:text-orange-300" },
	applied: { icon: SentIcon, className: "text-sky-600 dark:text-sky-300" },
	hr_screening: { icon: Call02Icon, className: "text-amber-600 dark:text-amber-300" },
	technical_interview: { icon: DiamondIcon, className: "text-violet-600 dark:text-violet-300" },
	offer: { icon: StarIcon, className: "text-emerald-600 dark:text-emerald-300" },
	rejected: { icon: Cancel01Icon, className: "text-negative" },
	withdrawn: { icon: Logout03Icon, className: "text-muted-foreground/70" },
	ghosted: { icon: HourglassIcon, className: "text-muted-foreground/70" },
};

/** A status as a glyph and a word in its colour; `detail` follows it ("3d", "Oct 21"). */
export function StatusMark({
	status,
	detail,
	className,
}: {
	status: Status;
	detail?: React.ReactNode;
	className?: string;
}) {
	const { icon, className: tone } = STATUS_LOOK[status];
	return (
		<span
			className={cn(
				"inline-flex min-w-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap",
				tone,
				className,
			)}
		>
			<HugeiconsIcon icon={icon} className="size-3.5 shrink-0" strokeWidth={2} />
			<span>{STATUS_CONFIG[status].label}</span>
			{detail && <span className="truncate font-normal opacity-75">· {detail}</span>}
		</span>
	);
}
