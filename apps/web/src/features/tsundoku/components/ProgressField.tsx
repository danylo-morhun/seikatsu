"use client";

import { parseProgressInput } from "@/features/tsundoku/lib/progress";
import { Button, Input, cn } from "@seikatsu/ui";
import { forwardRef, useState } from "react";

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
 * "I'm at p. 140" or "45%": one field, committed with Enter or the button. A percent needs the
 * page count; the hint under the field says what the entry will become before it's sent.
 */
export const ProgressField = forwardRef<HTMLInputElement, Props>(function ProgressField(
	{ id, currentPage, pageCount, onSubmit, disabled, className },
	ref,
) {
	const [raw, setRaw] = useState("");
	const page = raw.trim() ? parseProgressInput(raw, pageCount) : null;
	const invalid = raw.trim() !== "" && (page == null || (pageCount != null && page > pageCount));
	const hint = invalid
		? raw.includes("%") && !pageCount
			? "Add the page count to use percent."
			: pageCount
				? `A page from 0 to ${pageCount}, or a percent.`
				: "A page number."
		: page != null && raw.includes("%")
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
					placeholder={pageCount ? `I'm on page… or %` : "I'm on page…"}
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
					className={cn("text-[0.8rem]", invalid ? "text-destructive" : "text-muted-foreground")}
				>
					{hint}
				</p>
			)}
		</form>
	);
});
