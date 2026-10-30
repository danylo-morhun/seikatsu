"use client";

import { useDesign } from "@/components/DesignProvider";
import { TravelUnderline } from "@/components/TravelUnderline";
import { useIndicator } from "@/hooks/useIndicator";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * In-page section tabs (settings sections, Kyuu's views). Liquid Glass: a macOS segmented
 * control, a filled track whose lens slides to the current tab (content, so no glass).
 * Classic: a strip on a rule baseline with one travelling underline. Wide sets scroll sideways.
 */
export function PageTabs({ label, children }: { label: string; children: React.ReactNode }) {
	const glass = useDesign().design === "glass";
	const navRef = useRef<HTMLElement>(null);
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const location = `${pathname}?${searchParams.toString()}`;
	// The tapped tab, until the URL catches up, so the indicator leaves on the tap.
	const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
	const target = pending?.from === location ? pending.href : null;
	// Glass tabs carry no padding of their own (their label does), so the lens spans the whole
	// tab; Classic measures the label, so the underline spans the word.
	const tab = target ? `a[href="${CSS.escape(target)}"]` : '[aria-current="page"]';
	const indicator = useIndicator(
		navRef,
		glass ? tab : `${tab} > span`,
		`${location}|${target}|${glass}`,
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
			className={cn(
				"relative overflow-x-auto [scrollbar-width:none]",
				glass
					? "inline-flex max-w-full rounded-full bg-surface p-0.5"
					: "-mx-4 flex border-b border-rule px-1.5 sm:-mx-3 sm:px-0",
			)}
		>
			{glass
				? indicator && (
						<span
							aria-hidden
							className={cn(
								"pointer-events-none absolute inset-y-0.5 left-0 rounded-full bg-surface-2 shadow-sm",
								indicator.moved &&
									"transition-[transform,width] duration-300 ease-drawer motion-reduce:transition-none",
							)}
							style={{ width: indicator.w, transform: `translateX(${indicator.x}px)` }}
						/>
					)
				: null}
			{children}
			{!glass && <TravelUnderline indicator={indicator} />}
		</nav>
	);
}

/** Muted at rest; the current tab in ink, over the lens or above the underline. */
export function PageTab({
	href,
	current,
	children,
}: {
	href: string;
	current: boolean;
	children: React.ReactNode;
}) {
	const glass = useDesign().design === "glass";
	return (
		<Link
			href={href}
			prefetch
			aria-current={current ? "page" : undefined}
			className={cn(
				"relative shrink-0 text-sm whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
				glass ? "rounded-full" : "px-2.5 py-2.5 sm:px-3",
				current && "text-foreground",
			)}
		>
			<span className={cn(glass && "block px-3 py-1.5")}>{children}</span>
		</Link>
	);
}
