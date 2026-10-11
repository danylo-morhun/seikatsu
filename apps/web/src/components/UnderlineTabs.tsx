"use client";

import { TravelUnderline } from "@/components/TravelUnderline";
import { useIndicator } from "@/hooks/useIndicator";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

/**
 * Settings tab strip on a Rule baseline. It bleeds to the page edge so the first label
 * lines up with the content and every label fits a phone; wider sets scroll sideways.
 */
export function UnderlineTabs({ label, children }: { label: string; children: React.ReactNode }) {
	const navRef = useRef<HTMLElement>(null);
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const location = `${pathname}?${searchParams.toString()}`;
	// The tapped tab, until the URL catches up, so the underline leaves on the tap.
	const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
	const target = pending?.from === location ? pending.href : null;
	// One underline travels to the current tab.
	const underline = useIndicator(
		navRef,
		target ? `a[href="${CSS.escape(target)}"]` : '[aria-current="page"]',
		`${location}|${target}`,
	);
	return (
		<nav
			ref={navRef}
			onClick={(e) => {
				const href = (e.target as HTMLElement).closest("a")?.getAttribute("href");
				if (href) setPending({ href, from: location });
			}}
			aria-label={label}
			className="relative -mx-4 flex overflow-x-auto border-b border-rule px-1.5 [scrollbar-width:none] sm:-mx-3 sm:px-0"
		>
			{children}
			<TravelUnderline indicator={underline} />
		</nav>
	);
}

/** Muted at rest; the current tab in ink, with the strip's underline beneath it. */
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
				current && "text-foreground",
			)}
		>
			{children}
		</Link>
	);
}
