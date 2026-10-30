import { cn } from "@seikatsu/ui";
import type { CSSProperties } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

/** One figure of a figures row: label, the figure, an optional note. The lead is larger. */
export function Figure({
	label,
	value,
	unit,
	note,
	lead = false,
	index,
	className,
}: {
	label: string;
	/** Already formatted ("170 100"); null shows a dash. */
	value: string | null;
	unit?: string;
	note?: React.ReactNode;
	lead?: boolean;
	index: number;
	className?: string;
}) {
	return (
		<div className={cn("min-w-0 animate-rise py-1", className)} style={rise(index)}>
			<p className="truncate text-xs text-muted-foreground">{label}</p>
			<p
				data-total={lead ? "lead" : undefined}
				className={cn(
					"mt-1 truncate font-figures font-semibold tracking-tight",
					lead ? "text-3xl md:text-4xl" : "text-2xl md:text-[1.75rem]",
				)}
			>
				{value ?? "—"}
				{value != null && unit && (
					<span className="ml-1 text-base font-medium text-muted-foreground">{unit}</span>
				)}
			</p>
			{note && <div className="mt-1 truncate text-xs text-muted-foreground">{note}</div>}
		</div>
	);
}

/** The figures row: one rounded tile per figure, as in macOS; the lead spans both phone columns. */
export const FIGURES_ROW =
	"grid grid-cols-2 gap-3 md:gap-4 [&>*]:rounded-2xl [&>*]:bg-surface [&>*]:px-4 [&>*]:py-3.5";
