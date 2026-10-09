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
	className,
}: Props) {
	const end = (id: string, name: string) => {
		const cls = cn(
			"min-w-0 truncate",
			activeId === id ? "font-medium text-foreground" : "text-muted-foreground",
			onSelect && "underline-offset-2 hover:text-foreground hover:underline",
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
			{end(fromId, fromName)}
			<span aria-hidden data-flow-line className="flow-line relative h-px w-6 shrink-0 bg-flow" />
			<span className="sr-only">to</span>
			{end(toId, toName)}
		</span>
	);
}
