"use client";

import { useDesign } from "@/components/DesignProvider";
import type { Design } from "@/lib/design";
import { cn } from "@seikatsu/ui";
import { useRef } from "react";

const OPTIONS: { value: Design; name: string; note: string }[] = [
	{ value: "glass", name: "Liquid Glass", note: "macOS and iOS 26: glass bars, rounded groups" },
	{ value: "classic", name: "Classic", note: "Flat lacquer, ruled lists, underlined tabs" },
];

/** Settings → Account → Appearance: the look on this device, as a radio group of previews. */
export function AppearancePicker() {
	const { design, setDesign } = useDesign();
	const refs = useRef<(HTMLButtonElement | null)[]>([]);

	function onKeyDown(e: React.KeyboardEvent, index: number) {
		const step =
			e.key === "ArrowRight" || e.key === "ArrowDown"
				? 1
				: e.key === "ArrowLeft" || e.key === "ArrowUp"
					? -1
					: 0;
		if (!step) return;
		e.preventDefault();
		const next = (index + step + OPTIONS.length) % OPTIONS.length;
		setDesign(OPTIONS[next].value);
		refs.current[next]?.focus();
	}

	return (
		<div role="radiogroup" aria-label="Appearance" className="grid gap-3 sm:grid-cols-2">
			{OPTIONS.map((o, i) => {
				const checked = design === o.value;
				return (
					<button
						key={o.value}
						ref={(el) => {
							refs.current[i] = el;
						}}
						type="button"
						role="radio"
						aria-checked={checked}
						tabIndex={checked ? 0 : -1}
						onClick={() => setDesign(o.value)}
						onKeyDown={(e) => onKeyDown(e, i)}
						className={cn(
							"group flex flex-col gap-3 rounded-field p-3 text-left outline-none transition-[box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
							checked
								? "shadow-[inset_0_0_0_2px_var(--primary)]"
								: "shadow-[inset_0_0_0_1px_var(--rule)] hover:shadow-[inset_0_0_0_1px_var(--input)]",
						)}
					>
						<Preview design={o.value} />
						<span>
							<span className="block text-sm font-medium">{o.name}</span>
							<span className="block text-xs text-muted-foreground">{o.note}</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}

/** A thumbnail of each look: a list and its bottom bar, drawn with that look's shapes. */
function Preview({ design }: { design: Design }) {
	const glass = design === "glass";
	return (
		<span
			aria-hidden
			className="relative block h-24 overflow-hidden rounded-lg bg-background p-2.5"
		>
			<span
				className={cn(
					"block h-2 w-16 rounded-full bg-foreground/70",
					glass ? "mb-2.5" : "mb-2 h-1.5 w-10",
				)}
			/>
			<span
				className={cn("block", glass ? "rounded-md bg-surface px-1.5" : "border-y border-rule")}
			>
				{[0, 1, 2].map((i) => (
					<span
						key={i}
						className={cn("flex h-3.5 items-center gap-1", i > 0 && "border-t border-rule")}
					>
						<span className="h-1 w-12 rounded-full bg-foreground/40" />
					</span>
				))}
			</span>
			<span
				className={cn(
					"absolute inset-x-2.5 bottom-2 h-4",
					glass
						? "rounded-full bg-surface-2/80 shadow-[inset_0_1px_0_var(--glass-edge)]"
						: "rounded-md border border-rule bg-sidebar",
				)}
			/>
		</span>
	);
}
