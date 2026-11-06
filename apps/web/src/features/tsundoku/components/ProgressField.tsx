"use client";

import { Button, cn, Input } from "@seikatsu/ui";
import { forwardRef, useState } from "react";
import { parseProgressInput } from "@/features/tsundoku/lib/progress";

interface Props {
	id: string;
	currentPage: number;
	pageCount: number | null;
	/** Resolves when saved; the field clears then. */
	onSubmit: (page: number) => unknown;
	disabled?: boolean;
	className?: string;
}

/**
 * "I'm at p. 140", "+12" or "45%": one field, committed with Enter or the button. A percent needs the
 * page count; the hint under the field says what the entry will become before it's sent.
 */
export const ProgressField = forwardRef<HTMLInputElement, Props>(function ProgressField(
	{ id, currentPage, pageCount, onSubmit, disabled, className },
	ref,
) {
	const [raw, setRaw] = useState("");
	const page = raw.trim() ? parseProgressInput(raw, pageCount, currentPage) : null;
	const invalid = raw.trim() !== "" && (page == null || (pageCount != null && page > pageCount));
	const relative = raw.includes("%") || raw.trim().startsWith("+");
	// The number is where you are, not how much you read: say so before it moves the book back.
	const back = page != null && page < currentPage;
	const hint = invalid
		? raw.includes("%") && !pageCount
			? "Add the page count to use percent."
			: pageCount
				? `A page from 0 to ${pageCount}, +pages read, or a percent.`
				: "A page number, or +pages read."
		: back
			? `Back from page ${currentPage} to ${page}.${/^\d+$/.test(raw.trim()) ? ` Read ${raw.trim()} more? Type +${raw.trim()}.` : ""}`
			: page != null && relative
				? `Page ${page}`
				: null;

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (page == null || invalid || page === currentPage) return;
		await onSubmit(page);
		setRaw("");
	}

	return (
		<form onSubmit={submit} className={cn("space-y-1.5", className)}>
			<div className="flex gap-2">
				<label htmlFor={id} className="sr-only">
					Page you're on, or percent
				</label>
				{/* Phone number pads have no "+": this puts it in front (or takes it away). */}
				<Button
					type="button"
					variant="outline"
					size="icon"
					aria-label="Pages read instead of the page you're on"
					aria-pressed={raw.trim().startsWith("+")}
					disabled={disabled}
					className={cn("shrink-0 font-figures", raw.trim().startsWith("+") && "bg-surface-2")}
					onClick={() => {
						setRaw((r) => (r.trim().startsWith("+") ? r.trim().slice(1) : `+${r.trim()}`));
						document.getElementById(id)?.focus();
					}}
				>
					+
				</Button>
				<Input
					ref={ref}
					id={id}
					value={raw}
					inputMode="decimal"
					autoComplete="off"
					disabled={disabled}
					aria-invalid={invalid || undefined}
					aria-describedby={hint ? `${id}-hint` : undefined}
					aria-keyshortcuts="L"
					placeholder={pageCount ? "I'm on page…, +pages or %" : "I'm on page… or +pages"}
					onChange={(e) => setRaw(e.target.value)}
					className="font-figures"
				/>
				<Button
					type="submit"
					variant="outline"
					disabled={disabled || page == null || invalid || page === currentPage}
				>
					Update
				</Button>
			</div>
			{hint && (
				<p
					id={`${id}-hint`}
					className={cn(
						"text-[0.8rem]",
						invalid ? "text-destructive" : back ? "text-foreground" : "text-muted-foreground",
					)}
				>
					{hint}
				</p>
			)}
		</form>
	);
});
