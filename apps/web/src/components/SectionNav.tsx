"use client";

import { useDesign } from "@/components/DesignProvider";
import { TravelUnderline } from "@/components/TravelUnderline";
import { useIndicator } from "@/hooks/useIndicator";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

export interface Section {
	value: string;
	label: string;
	href: string;
}

interface Props {
	label: string;
	sections: Section[];
	current: string;
	onSelect: (value: string) => void;
}

/**
 * The header's section switcher. Liquid Glass: a macOS segmented control, a glass capsule whose
 * lens slides to the open section. Classic: tabs on the header's baseline with one travelling
 * underline.
 */
export function SectionNav(props: Props) {
	return useDesign().design === "glass" ? <Segmented {...props} /> : <Underlined {...props} />;
}

function Segmented({ label, sections, current, onSelect }: Props) {
	const navRef = useRef<HTMLElement>(null);
	// Measured from the lit segment so the lens hugs its label.
	const [lens, setLens] = useState<{ x: number; w: number; moved: boolean } | null>(null);
	useLayoutEffect(() => {
		const nav = navRef.current;
		function place() {
			const lit = nav?.querySelector<HTMLElement>(`[data-tab="${current}"]`);
			if (!lit) return setLens(null);
			setLens((prev) => ({ x: lit.offsetLeft, w: lit.offsetWidth, moved: prev !== null }));
		}
		place();
		window.addEventListener("resize", place);
		return () => window.removeEventListener("resize", place);
	}, [current]);

	return (
		<nav
			ref={navRef}
			aria-label={label}
			className="glass relative ml-1 hidden h-9 shrink-0 rounded-full p-0.5 md:flex lg:ml-3"
		>
			{lens && (
				<span
					aria-hidden
					className={cn(
						"absolute inset-y-0.5 left-0 rounded-full bg-(--glass-lens)",
						lens.moved &&
							"transition-[transform,width] duration-300 ease-drawer motion-reduce:transition-none",
					)}
					style={{ width: lens.w, transform: `translateX(${lens.x}px)` }}
				/>
			)}
			{sections.map(({ value, label: text, href }) => {
				const active = current === value;
				return (
					<Link
						key={value}
						href={href}
						prefetch
						data-tab={value}
						aria-current={active ? "page" : undefined}
						onClick={() => onSelect(value)}
						className={cn(
							"relative flex items-center justify-center rounded-full px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring lg:px-4",
							active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
						)}
					>
						{text}
					</Link>
				);
			})}
		</nav>
	);
}

function Underlined({ label, sections, current, onSelect }: Props) {
	const navRef = useRef<HTMLElement>(null);
	// One underline that travels between tabs, so the eye follows where you went.
	const underline = useIndicator(navRef, `[data-tab="${current}"] > span`, current);
	return (
		<nav
			ref={navRef}
			aria-label={label}
			className="relative ml-3 hidden h-full shrink-0 items-stretch md:flex lg:ml-5"
		>
			<TravelUnderline indicator={underline} />
			{sections.map(({ value, label: text, href }) => {
				const active = current === value;
				return (
					<Link
						key={value}
						href={href}
						prefetch
						data-tab={value}
						aria-current={active ? "page" : undefined}
						onClick={() => onSelect(value)}
						className={cn(
							"group relative flex items-center px-1 text-sm font-medium whitespace-nowrap outline-none transition-colors",
							active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
						)}
					>
						<span className="rounded-md px-2.5 py-1.5 transition-colors group-hover:bg-surface-2 group-focus-visible:ring-2 group-focus-visible:ring-ring">
							{text}
						</span>
					</Link>
				);
			})}
		</nav>
	);
}
