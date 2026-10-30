"use client";

import { useIndicator } from "@/hooks/useIndicator";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A macOS segmented control for in-page sections: a filled track whose lens slides to the
 * current tab. Content, so no glass (the header's section control is the glass one). Wide sets
 * scroll sideways inside the track.
 */
export function SegmentedTabs({ label, children }: { label: string; children: React.ReactNode }) {
	const navRef = useRef<HTMLElement>(null);
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const location = `${pathname}?${searchParams.toString()}`;
	// The tapped tab, until the URL catches up, so the lens leaves on the tap.
	const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
	const target = pending?.from === location ? pending.href : null;
	// Tabs carry no padding of their own (their label does), so the lens spans the whole tab.
	const lens = useIndicator(
		navRef,
		target ? `a[href="${CSS.escape(target)}"]` : '[aria-current="page"]',
		`${location}|${target}`,
	);
	// A wide set scrolls inside its track; keep the current tab in view.
	useEffect(() => {
		navRef.current
			?.querySelector('[aria-current="page"]')
			?.scrollIntoView({ block: "nearest", inline: "nearest" });
	}, [location]);

	return (
		<nav
			ref={navRef}
			onClick={(e) => {
				const href = (e.target as HTMLElement).closest("a")?.getAttribute("href");
				if (href) setPending({ href, from: location });
			}}
			aria-label={label}
			className="relative inline-flex max-w-full overflow-x-auto rounded-full bg-surface p-0.5 [scrollbar-width:none]"
		>
			{lens && (
				<span
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0.5 left-0 rounded-full bg-surface-2 shadow-sm",
						lens.moved &&
							"transition-[transform,width] duration-300 ease-drawer motion-reduce:transition-none",
					)}
					style={{ width: lens.w, transform: `translateX(${lens.x}px)` }}
				/>
			)}
			{children}
		</nav>
	);
}

/** Muted at rest; the current tab in ink, with the track's lens beneath it. */
export function SegmentedTab({
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
				"relative shrink-0 rounded-full text-sm whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
				current && "text-foreground",
			)}
		>
			<span className="block px-3 py-1.5">{children}</span>
		</Link>
	);
}
