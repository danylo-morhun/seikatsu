import { cn } from "@seikatsu/ui";
import { useId } from "react";

/**
 * One settings page, like macOS System Settings: a large title, optional section tabs, then
 * grouped sections.
 * `appNav` leaves room for an app's floating bottom navigation on phones.
 */
export function SettingsPage({
	title,
	tabs,
	appNav = false,
	children,
}: {
	title: string;
	tabs?: React.ReactNode;
	appNav?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className={cn("max-w-3xl px-4 pt-6 sm:px-8 md:pt-8 md:pb-8", appNav ? "pb-28" : "pb-8")}>
			<h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">{title}</h1>
			{tabs && <div className="mt-4">{tabs}</div>}
			<div className="mt-6 space-y-8">{children}</div>
		</div>
	);
}

/**
 * A settings section, as in System Settings: a small title and a muted line on what it does
 * above one rounded group holding the controls; at right either the section's action or a
 * quiet figure (a count, a status). The title is optional when a tab already names the section.
 */
export function SettingsSection({
	title,
	description,
	action,
	meta,
	children,
	className,
}: {
	title?: string;
	description?: React.ReactNode;
	action?: React.ReactNode;
	meta?: React.ReactNode;
	children?: React.ReactNode;
	className?: string;
}) {
	const id = useId();
	return (
		<section aria-labelledby={title ? id : undefined} className={className}>
			<div className="flex items-start justify-between gap-4 px-1">
				<div className="min-w-0">
					{title && (
						<h2 id={id} className="text-sm font-semibold">
							{title}
						</h2>
					)}
					{description && (
						<p className={cn("max-w-prose text-sm text-muted-foreground", title && "mt-0.5")}>
							{description}
						</p>
					)}
				</div>
				{action && <div className="shrink-0">{action}</div>}
				{!action && meta != null && (
					<span className="shrink-0 pt-px font-figures text-xs text-muted-foreground">{meta}</span>
				)}
			</div>
			{children && (
				<div className={cn("rounded-2xl bg-surface p-4", (title || description) && "mt-3")}>
					{children}
				</div>
			)}
		</section>
	);
}

/** A closing line under a page that points to where related things live. */
export function SettingsNote({ children }: { children: React.ReactNode }) {
	return <p className="text-sm text-muted-foreground">{children}</p>;
}

export const NOTE_LINK = "text-foreground underline-offset-2 hover:underline";
