import { cn } from "@seikatsu/ui";

/** The dialog footer: right-aligned on desktop, a sticky full-width bar on phones. */
export const FOOTER =
	"mt-auto flex justify-end gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4";

/** Opened by a key: no entrance motion. */
export const instantClass = (instant: boolean | undefined) =>
	instant ? "data-[state=closed]:animate-none data-[state=open]:animate-none" : undefined;

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
	return (
		<p id={id} role="alert" className="text-[0.8rem] text-destructive">
			{children}
		</p>
	);
}

/** A row of equal choices with one chip that slides under the chosen one. */
export function Segmented<T extends string>({
	labelledBy,
	options,
	value,
	onChange,
}: {
	labelledBy: string;
	options: readonly { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
}) {
	const index = options.findIndex((o) => o.value === value);
	return (
		<div
			role="radiogroup"
			aria-labelledby={labelledBy}
			className="relative grid rounded-md bg-surface p-0.5"
			style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
		>
			<span
				aria-hidden
				className="absolute inset-y-0.5 left-0.5 rounded bg-surface-2 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
				style={{
					width: `calc((100% - 0.25rem) / ${options.length})`,
					transform: `translateX(${Math.max(index, 0) * 100}%)`,
				}}
			/>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					role="radio"
					aria-checked={value === o.value}
					onClick={() => onChange(o.value)}
					className={cn(
						"relative h-9 truncate rounded px-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring max-sm:h-10",
						value === o.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
					)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}
