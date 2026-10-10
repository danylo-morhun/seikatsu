import { cn } from "@seikatsu/ui";
import Link from "next/link";

/**
 * Settings tab strip on a Rule baseline. It bleeds to the page edge so the first label
 * lines up with the content and every label fits a phone; wider sets scroll sideways.
 */
export function UnderlineTabs({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<nav
			aria-label={label}
			className="-mx-4 flex overflow-x-auto border-b border-rule px-1.5 [scrollbar-width:none] sm:-mx-3 sm:px-0"
		>
			{children}
		</nav>
	);
}

/** Muted at rest; the current tab in ink over a 2px pigment underline. */
export function UnderlineTab({
	href,
	current,
	children,
}: {
	href: string;
	current: boolean;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			prefetch
			aria-current={current ? "page" : undefined}
			className={cn(
				"relative shrink-0 px-2.5 py-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:px-3",
				current &&
					"text-foreground after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary sm:after:inset-x-3",
			)}
		>
			{children}
		</Link>
	);
}
