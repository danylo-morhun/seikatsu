"use client";

import { ColorSwatches } from "@/components/ColorSwatches";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { SettingsSection } from "@/components/SettingsSection";
import { Spinner } from "@/components/Spinner";
import {
	type ShelfWithCount,
	createShelf,
	deleteShelf,
	updateShelf,
} from "@/features/tsundoku/actions/shelves";
import { useHeld } from "@/hooks/useHeld";
import { LABEL_COLORS } from "@/lib/pigments";
import { Delete01Icon, MoreHorizontalIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	Label,
} from "@seikatsu/ui";
import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

type Editing = { shelf: ShelfWithCount | null } | null;

const FOOTER =
	"mt-auto flex justify-end gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4";

/** Shelves as Seiryu's labels: a hairline list of name, colour and how many books are on it. */
export function SettingsShelves({ shelves }: { shelves: ShelfWithCount[] }) {
	const [editing, setEditing] = useState<Editing>(null);
	const [deleting, setDeleting] = useState<ShelfWithCount | null>(null);

	return (
		<SettingsSection
			title="Shelves"
			description="Your own collections; a book can sit on several. Shelve a book from its page."
			action={
				<Button variant="outline" onClick={() => setEditing({ shelf: null })}>
					New Shelf
				</Button>
			}
		>
			{shelves.length === 0 ? (
				<p className="py-4 text-sm text-muted-foreground">
					None yet. Make one for a series of picks — “Favourites”, “To lend”, “2026 challenge”.
				</p>
			) : (
				<ul className="animate-rise inset-group">
					{shelves.map((shelf) => (
						<li key={shelf.id} className="flex items-center gap-3 py-2.5">
							<span
								aria-hidden
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: shelf.color ?? "var(--muted-foreground)" }}
							/>
							<Link
								href={`/tsundoku?shelf=${shelf.id}`}
								prefetch={false}
								className="min-w-0 flex-1 truncate text-sm hover:underline"
							>
								{shelf.name}
							</Link>
							<span className="shrink-0 font-figures text-xs text-muted-foreground">
								{shelf.bookCount} {shelf.bookCount === 1 ? "book" : "books"}
							</span>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="size-10 text-muted-foreground/50 md:size-8 hover:text-foreground"
										aria-label={`Actions for ${shelf.name}`}
									>
										<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => setEditing({ shelf })}>
										<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
										Edit
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										onClick={() => setDeleting(shelf)}
									>
										<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
										Delete…
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					))}
				</ul>
			)}

			<ShelfDialog
				editing={editing}
				count={shelves.length}
				onOpenChange={(open) => !open && setEditing(null)}
			/>
			<ConfirmDelete
				open={!!deleting}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete "${deleting?.name ?? ""}"?`}
				description={
					deleting && deleting.bookCount > 0
						? `It comes off ${deleting.bookCount} ${deleting.bookCount === 1 ? "book" : "books"}; the books stay.`
						: "No book is on it."
				}
				onConfirm={async () => {
					if (!deleting) return;
					const result = await deleteShelf(deleting.id).catch(() => ({
						error: "Couldn't delete the shelf.",
					}));
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</SettingsSection>
	);
}

function ShelfDialog({
	editing: editingProp,
	count,
	onOpenChange,
}: {
	editing: Editing;
	count: number;
	onOpenChange: (open: boolean) => void;
}) {
	const editing = useHeld(editingProp, editingProp != null);
	const id = useId();
	const shelf = editing?.shelf ?? null;
	const [name, setName] = useState("");
	const [color, setColor] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();

	useEffect(() => {
		if (!editing) return;
		setName(shelf?.name ?? "");
		setColor(shelf?.color ?? LABEL_COLORS[count % LABEL_COLORS.length]?.hex ?? null);
		setError(null);
	}, [editing, shelf, count]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		startSave(async () => {
			const values = { name: name.trim(), color };
			const result = await (shelf ? updateShelf(shelf.id, values) : createShelf(values)).catch(
				() => ({ error: "Couldn't save the shelf." }),
			);
			if ("error" in result) setError(result.error);
			else onOpenChange(false);
		});
	}

	return (
		<Dialog open={editingProp != null} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent className="sm:max-w-md max-sm:flex max-sm:flex-col">
				<DialogHeader>
					<DialogTitle>{shelf ? "Edit Shelf" : "New Shelf"}</DialogTitle>
					<DialogDescription className="sr-only">
						Name the shelf and pick its colour.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-name`}>Name</Label>
						<Input
							id={`${id}-name`}
							value={name}
							maxLength={100}
							autoComplete="off"
							aria-invalid={!!error || undefined}
							aria-describedby={error ? `${id}-error` : undefined}
							onChange={(e) => {
								setName(e.target.value);
								setError(null);
							}}
						/>
						{error && (
							<p id={`${id}-error`} className="text-[0.8rem] text-destructive">
								{error}
							</p>
						)}
					</div>
					<div className="space-y-2">
						<Label>Colour</Label>
						<ColorSwatches value={color} onChange={setColor} label="Shelf colour" />
					</div>
					<div className={FOOTER}>
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="gap-1.5 max-sm:flex-1"
							disabled={isSaving || !name.trim()}
						>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : shelf ? "Save" : "Make shelf"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
