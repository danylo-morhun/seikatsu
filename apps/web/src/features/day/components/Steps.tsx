import { cn } from "@seikatsu/ui";

/** Where a ritual is: one bar per step, lit up to this one. */
export function Steps({ step, of }: { step: number; of: number }) {
	return (
		<div aria-label={`Step ${step + 1} of ${of}`} className="mb-4 flex gap-1.5">
			{Array.from({ length: of }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed steps
					key={i}
					className={cn("h-1 w-6 rounded-full", i <= step ? "bg-primary" : "bg-surface-2")}
				/>
			))}
		</div>
	);
}
