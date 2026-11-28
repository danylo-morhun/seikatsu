"use client";

import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePendingProgress } from "@/hooks/usePendingProgress";
import { pageKey } from "@/lib/capture-shortcut";

/** Typing waits this long before the page searches. */
const WAIT_MS = 250;

/**
 * Searching the events: `/` (or the button) opens the field; what's typed goes into `?q=` and the
 * page lists what it finds in place of the days. Esc clears it and goes back to the days.
 */
export function CalendarSearch({ q }: { q: string }) {
	const router = useRouter();
	const path = usePathname();
	const params = useSearchParams();
	const [open, setOpen] = useState(q !== "");
	const [text, setText] = useState(q);
	const [isPending, startTransition] = useTransition();
	usePendingProgress(isPending);
	const input = useRef<HTMLInputElement>(null);

	const go = (next: string) => {
		const p = new URLSearchParams(params.toString());
		if (next.trim()) p.set("q", next.trim());
		else p.delete("q");
		const qs = p.toString();
		startTransition(() => router.replace(qs ? `${path}?${qs}` : path, { scroll: false }));
	};

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (pageKey(e) !== "/") return;
			e.preventDefault();
			setOpen(true);
			requestAnimationFrame(() => input.current?.focus());
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// The words settle, then the page searches.
	useEffect(() => {
		if (text.trim() === q) return;
		const t = setTimeout(() => go(text), WAIT_MS);
		return () => clearTimeout(t);
	}, [text, q]);

	const close = () => {
		setText("");
		setOpen(false);
		if (q) go("");
	};

	if (!open)
		return (
			<button
				type="button"
				aria-label="Search events"
				aria-keyshortcuts="/"
				onClick={() => {
					setOpen(true);
					requestAnimationFrame(() => input.current?.focus());
				}}
				className="flex size-9 items-center justify-center rounded-button bg-surface text-muted-foreground outline-none transition-colors duration-150 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
			>
				<HugeiconsIcon icon={Search01Icon} className="size-4" />
			</button>
		);

	return (
		<div
			className={cn(
				"flex h-9 w-56 items-center gap-2 rounded-field border border-[var(--search-border)] bg-[var(--search-bg)] px-2.5",
				"focus-within:ring-2 focus-within:ring-ring",
			)}
		>
			<HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0 text-muted-foreground" />
			<input
				ref={input}
				type="search"
				aria-label="Search events"
				value={text}
				placeholder="Search events"
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						close();
					}
					if (e.key === "Enter") go(text);
				}}
				onBlur={() => {
					if (!text.trim()) setOpen(false);
				}}
				className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
			/>
			{text && (
				<button
					type="button"
					aria-label="Clear the search"
					onClick={close}
					className="text-muted-foreground hover:text-foreground"
				>
					<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
				</button>
			)}
		</div>
	);
}
