"use client";

import { ProgressField } from "@/features/tsundoku/components/ProgressField";
import { ProgressMeter } from "@/features/tsundoku/components/ProgressMeter";
import { useHeld } from "@/hooks/useHeld";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	cn,
} from "@seikatsu/ui";
import { useId } from "react";

export interface ProgressTarget {
	id: string;
	title: string;
	currentPage: number;
	pageCount: number | null;
}

interface Props {
	book: ProgressTarget | null;
	onOpenChange: (open: boolean) => void;
	onSave: (bookId: string, page: number) => void;
	/** Opened with L: no motion. */
	instant?: boolean;
}

/** The library's quick progress update: where you are now, in pages or percent. */
export function ProgressDialog({ book: bookProp, onOpenChange, onSave, instant = false }: Props) {
	const id = useId();
	// Keeps its title and meter while it fades out.
	const book = useHeld(bookProp, bookProp != null);

	return (
		<Dialog open={bookProp != null} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"sm:max-w-md",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
				onOpenAutoFocus={(e) => {
					const field = document.getElementById(`${id}-page`);
					if (!field) return;
					e.preventDefault();
					field.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle className="leading-snug break-words">{book?.title}</DialogTitle>
					<DialogDescription>
						Where are you now? Today's pages count toward your streak.
					</DialogDescription>
				</DialogHeader>
				{book && (
					<div className="space-y-4">
						<ProgressMeter currentPage={book.currentPage} pageCount={book.pageCount} />
						<ProgressField
							id={`${id}-page`}
							currentPage={book.currentPage}
							pageCount={book.pageCount}
							onSubmit={(page) => {
								onSave(book.id, page);
								onOpenChange(false);
							}}
						/>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
