import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { APPS_CONFIG } from "@/lib/app-themes";

export type AppHref = keyof typeof APPS_CONFIG;

/** The app's seal, as the sidebar has it. */
export function Seal({ href }: { href: AppHref }) {
	const app = APPS_CONFIG[href];
	return (
		<span
			aria-hidden
			className={cn(
				app.theme,
				"flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[13px] font-semibold text-primary",
			)}
		>
			{app.kanji}
		</span>
	);
}

/** One running thing in "Now": a seal, what it stands at, and its one quick update. The text
 * opens the app. */
export function Line({
	href,
	title,
	note,
	action,
	children,
}: {
	href: AppHref;
	title: string;
	note?: string | null;
	action?: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<li className="flex min-h-14 items-center gap-3 py-2">
			<Seal href={href} />
			<div className="min-w-0 flex-1">
				<Link href={href} prefetch className="group block outline-none">
					<span className="block truncate text-sm font-medium group-hover:underline group-focus-visible:underline">
						{title}
					</span>
					{note && <span className="block truncate text-xs text-muted-foreground">{note}</span>}
				</Link>
				{children}
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</li>
	);
}

const PULSE = "animate-pulse rounded-md bg-surface-2";

/** A line while its summary loads, at its real height. */
export function LineSkeleton() {
	return (
		<li aria-hidden className="flex min-h-14 items-center gap-3 py-2">
			<div className={cn(PULSE, "size-7")} />
			<div className="flex-1 space-y-1.5">
				<div className={cn(PULSE, "h-3.5 w-32")} />
				<div className={cn(PULSE, "h-3 w-20")} />
			</div>
		</li>
	);
}

/** A line's quick update: the outline button the apps use for a row's quick update. */
export function LineAction({
	label,
	keys,
	children,
	...props
}: { label: string; keys?: string } & React.ComponentProps<typeof Button>) {
	return (
		<Button variant="outline" size="sm" aria-label={label} aria-keyshortcuts={keys} {...props}>
			{children}
		</Button>
	);
}
