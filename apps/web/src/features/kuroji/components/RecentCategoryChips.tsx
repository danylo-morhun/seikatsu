"use client";

import { cn } from "@seikatsu/ui";
import * as React from "react";

type Category = { id: string; name: string };

/**
 * Recent categories as quiet text on the field's label line, so the select below stays level
 * with its neighbour. One line; past the edge it scrolls, faded where there is more.
 */
export function RecentCategoryChips({
	categories,
	selectedId,
	onPick,
	className,
}: {
	categories: Category[];
	selectedId: string | undefined;
	onPick: (id: string) => void;
	className?: string;
}) {
	const ref = React.useRef<HTMLDivElement>(null);
	const [more, setMore] = React.useState({ before: false, after: false });

	const measure = React.useCallback(() => {
		const el = ref.current;
		if (!el) return;
		setMore({
			before: el.scrollLeft > 1,
			after: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
		});
	}, []);

	React.useEffect(() => {
		const el = ref.current;
		if (!el) return;
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		// The chips themselves change width when the list changes (another tab's categories).
		if (el.firstElementChild) observer.observe(el.firstElementChild);
		return () => observer.disconnect();
	}, [measure]);

	return (
		<div
			ref={ref}
			onScroll={measure}
			role="group"
			aria-label="Recent categories"
			className={cn(
				"flex overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
				more.before &&
					more.after &&
					"[mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1rem),transparent)]",
				more.before &&
					!more.after &&
					"[mask-image:linear-gradient(to_right,transparent,black_1rem)]",
				!more.before &&
					more.after &&
					"[mask-image:linear-gradient(to_left,transparent,black_1rem)]",
				className,
			)}
		>
			<div className="flex h-3.5 w-max items-center gap-3">
				{categories.map((c) => {
					const selected = selectedId === c.id;
					return (
						<button
							key={c.id}
							type="button"
							aria-pressed={selected}
							onClick={() => onPick(c.id)}
							// The padding widens the tap target without growing the line.
							className={cn(
								"-my-2 whitespace-nowrap py-2 text-xs leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:outline-none",
								selected && "text-foreground underline decoration-foreground/60 underline-offset-4",
							)}
						>
							{c.name}
						</button>
					);
				})}
			</div>
		</div>
	);
}
