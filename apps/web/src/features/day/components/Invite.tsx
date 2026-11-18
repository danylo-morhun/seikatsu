import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";

/** The card that opens a ritual when it's due: the morning, the evening, the week. */
export function Invite({
	href,
	eyebrow,
	title,
	note,
	evening = false,
}: {
	href: string;
	eyebrow: string;
	title: string;
	note: string;
	evening?: boolean;
}) {
	return (
		<Link
			href={href}
			prefetch
			aria-keyshortcuts="O"
			className={cn(
				"group flex items-center gap-4 rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-4 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring",
				evening && "theme-keizoku",
			)}
		>
			<div className="min-w-0 flex-1">
				<p className="text-xs font-medium tracking-wide text-primary uppercase">{eyebrow}</p>
				<p className="mt-0.5 text-base font-semibold">{title}</p>
				<p className="mt-0.5 text-sm text-muted-foreground">{note}</p>
			</div>
			<HugeiconsIcon
				icon={ArrowRight01Icon}
				aria-hidden
				className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
			/>
		</Link>
	);
}
