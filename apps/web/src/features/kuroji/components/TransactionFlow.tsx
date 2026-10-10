import { isUncategorized } from "@/features/kuroji/lib/quick-categorize";
import { cn } from "@seikatsu/ui";

interface Props {
	fromId: string;
	fromName: string;
	toId: string;
	toName: string;
	/** Account the list is filtered to, shown emphasized. */
	activeId?: string;
	/** Clicking an account filters the list to it; omit for a static flow. */
	onSelect?: (accountId: string) => void;
	/** Which end is the category; with `onCategorize` it opens the category picker. */
	categoryEnd?: "from" | "to";
	onCategorize?: (anchor: HTMLElement) => void;
	className?: string;
}

/**
 * Double entry, drawn: money leaves one account and lands in another. The connecting
 * line is the product's signature — its colour and finish come from the visual world.
 */
export function TransactionFlow({
	fromId,
	fromName,
	toId,
	toName,
	activeId,
	onSelect,
	categoryEnd,
	onCategorize,
	className,
}: Props) {
	const end = (id: string, name: string, side: "from" | "to") => {
		if (onCategorize && side === categoryEnd) {
			// Unfiled money is the one to fix: a dashed underline asks for a category.
			return (
				<button
					type="button"
					aria-label={`Category: ${name}, change`}
					className={cn(
						"relative z-10 min-w-0 truncate rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring",
						activeId === id ? "font-medium text-foreground" : "text-muted-foreground",
						isUncategorized(name) && "underline decoration-muted-foreground/60 decoration-dashed",
					)}
					onClick={(e) => {
						e.stopPropagation();
						onCategorize(e.currentTarget);
					}}
				>
					{name}
				</button>
			);
		}
		const cls = cn(
			"min-w-0 truncate",
			activeId === id ? "font-medium text-foreground" : "text-muted-foreground",
			onSelect && "relative z-10 underline-offset-2 hover:text-foreground hover:underline",
		);
		return onSelect ? (
			<button
				type="button"
				className={cls}
				title={`Show only ${name}`}
				onClick={(e) => {
					e.stopPropagation();
					onSelect(id);
				}}
			>
				{name}
			</button>
		) : (
			<span className={cls}>{name}</span>
		);
	};

	return (
		<span className={cn("flex min-w-0 items-center gap-2 text-sm", className)}>
			{end(fromId, fromName, "from")}
			<span aria-hidden data-flow-line className="flow-line relative h-px w-6 shrink-0 bg-flow" />
			<span className="sr-only">to</span>
			{end(toId, toName, "to")}
		</span>
	);
}
