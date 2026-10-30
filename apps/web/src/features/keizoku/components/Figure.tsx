import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn } from "@seikatsu/ui";
import type { CSSProperties } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

/** One figure of a figures row: label, the number, an optional note. The lead is larger. */
export function Figure({
	label,
	value,
	note,
	lead = false,
	index,
	suffix,
	of,
}: {
	label: string;
	value: number | null;
	note?: React.ReactNode;
	lead?: boolean;
	index: number;
	suffix?: string;
	/** "3 / 7": the whole the value is out of. */
	of?: number;
}) {
	return (
		<div className="min-w-0 animate-rise py-1" style={rise(index)}>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p
				data-total={lead ? "lead" : undefined}
				className={cn(
					"mt-1 truncate font-figures font-semibold tracking-tight",
					lead ? "text-3xl md:text-4xl" : "text-2xl md:text-[1.75rem]",
				)}
			>
				{value == null ? "—" : <AnimatedNumber value={value} />}
				{value != null && of != null && <span className="text-muted-foreground"> / {of}</span>}
				{value != null && suffix && (
					<span className="ml-1 text-base font-medium text-muted-foreground">{suffix}</span>
				)}
			</p>
			{note && <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p>}
		</div>
	);
}

/** The figures row: one rounded tile per figure, as in macOS; the lead spans both phone columns. */
export const FIGURES_ROW =
	"grid grid-cols-2 gap-3 md:gap-4 [&>*]:rounded-2xl [&>*]:bg-surface [&>*]:px-4 [&>*]:py-3.5";
