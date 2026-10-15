import { cn } from "@seikatsu/ui";
import Link from "next/link";

/** The years with any activity, newest first; one chip slides under the year shown. */
export function YearSwitch({
	years,
	year,
	base,
}: {
	years: number[];
	year: number;
	/** The year page's path; the newest year is the bare path. */
	base: string;
}) {
	const index = Math.max(0, years.indexOf(year));
	return (
		<nav
			aria-label="Year"
			className="relative inline-flex max-w-full overflow-x-auto rounded-md bg-surface p-0.5"
		>
			<span
				aria-hidden
				className="absolute inset-y-0.5 left-0.5 w-14 rounded bg-surface-2 transition-transform duration-250 ease-in-out motion-reduce:transition-none"
				style={{ transform: `translateX(${index * 100}%)` }}
			/>
			{years.map((y, i) => (
				<Link
					key={y}
					href={i === 0 ? base : `${base}?year=${y}`}
					prefetch
					aria-current={y === year ? "page" : undefined}
					className={cn(
						"relative w-14 shrink-0 rounded py-1 text-center font-figures text-xs font-medium transition-colors",
						y === year ? "text-foreground" : "text-muted-foreground hover:text-foreground",
					)}
				>
					{y}
				</Link>
			))}
		</nav>
	);
}
