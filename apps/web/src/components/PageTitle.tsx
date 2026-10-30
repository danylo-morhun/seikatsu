import { cn } from "@seikatsu/ui";

/**
 * A screen's large title, as in macOS and iOS: bold 28px, an optional muted line under it, and
 * the screen's own actions at right. Classic names the screen for screen readers only, as it
 * always did (the header's tabs already say where you are).
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
		<div
			className={cn(
				"mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 classic:sr-only",
				className,
			)}
		>
			<div className="min-w-0">
				<h1 className="title-large">{title}</h1>
				{subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
			</div>
			{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
		</div>
	);
}
