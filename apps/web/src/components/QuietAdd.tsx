import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";

/** Kuroji's "+ Add tags": a quiet text toggle that opens a field only when it's wanted. */
export function QuietAdd({
	children,
	onClick,
	className,
}: { children: React.ReactNode; onClick: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex h-9 items-center gap-1.5 self-start rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
		>
			<HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" />
			{children}
		</button>
	);
}
