import { cn } from "@seikatsu/ui";

/** A key cap, as the shortcuts sheet and menus name keys. */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
	return (
		<kbd
			className={cn(
				"inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-rule bg-surface px-1.5 font-sans text-xs text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}
