import { cn } from "@seikatsu/ui";
import { STATUS_CONFIG, type Status, type Tone } from "../lib/stages";

const DOT: Record<Tone, string> = {
	quiet: "shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]",
	waiting: "bg-muted-foreground/60",
	active: "bg-primary",
	won: "bg-positive",
	lost: "bg-muted-foreground/25",
};

/** A status as a dot and a word: where the application stands, not a colour per status. */
export function StatusMark({
	status,
	className,
	hideLabel = false,
}: {
	status: Status;
	className?: string;
	hideLabel?: boolean;
}) {
	const { label, tone } = STATUS_CONFIG[status];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
				tone === "active" || tone === "won" ? "text-foreground" : "text-muted-foreground",
				className,
			)}
		>
			<span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[tone])} />
			<span className={cn(hideLabel && "sr-only")}>{label}</span>
		</span>
	);
}
