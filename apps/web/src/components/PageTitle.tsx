import { cn } from "@seikatsu/ui";

/**
 * A screen's large title, as in macOS and iOS: bold 28px, an optional muted line under it, and
 * the screen's own actions at right.
 */
export function PageTitle({
	title,
	subtitle,
	actions,
	className,
}: {
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
			<div className="min-w-0">
				<h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">{title}</h1>
				{subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
			</div>
			{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
		</div>
	);
}

/**
 * A macOS inset grouped list: one rounded group on a slightly lighter tone, separators inset
 * from its edges. Content, so it never takes glass.
 */
export const INSET_GROUP = "rounded-2xl bg-surface px-4 divide-y divide-rule";
