"use client";

import { CardDetail } from "@/features/seiryu/components/CardDetail";
import { ConfirmDelete } from "@/features/seiryu/components/ConfirmDelete";
import type { CardData, CardFieldUpdates, LabelData } from "@/features/seiryu/lib/types";
import {
	Archive01Icon,
	Delete01Icon,
	MoreHorizontalIcon,
	SquareArrowUpRightIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@seikatsu/ui";
import Link from "next/link";
import { useId, useRef, useState } from "react";

interface Props {
	card: CardData | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	columns: { id: string; name: string }[];
	projectLabels: LabelData[];
	onSave: (cardId: string, updates: CardFieldUpdates) => void;
	onMove: (cardId: string, columnId: string) => void;
	onChange: (cardId: string, updates: Partial<CardData>) => void;
	onArchive: (cardId: string) => void;
	onDelete: (cardId: string) => Promise<unknown>;
	onProjectLabelsChange?: (labels: LabelData[]) => void;
}

export function CardSheet({
	card,
	open,
	onOpenChange,
	columns,
	projectLabels,
	onSave,
	onMove,
	onChange,
	onArchive,
	onDelete,
	onProjectLabelsChange,
}: Props) {
	const titleId = useId();
	const [confirmDelete, setConfirmDelete] = useState(false);
	// The sheet slides out after its card is archived or deleted: keep showing it meanwhile.
	const lastCard = useRef(card);
	if (card) lastCard.current = card;
	const shown = card ?? lastCard.current;

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent
					side="right"
					aria-labelledby={titleId}
					className="w-full gap-0 text-sm data-[side=right]:w-full sm:max-w-lg data-[side=right]:sm:max-w-lg"
					// Focus the sheet itself, not the title: on a phone that would pop the keyboard.
					onOpenAutoFocus={(e) => {
						e.preventDefault();
						(e.currentTarget as HTMLElement | null)?.focus();
					}}
					// Back to the card it came from (it was opened by state, not a trigger).
					onCloseAutoFocus={(e) => {
						if (!shown) return;
						const tile = document.querySelector<HTMLElement>(`[data-card-id="${shown.id}"]`);
						if (tile) {
							e.preventDefault();
							tile.focus({ preventScroll: true });
						}
					}}
				>
					<SheetTitle className="sr-only">{shown?.title ?? "Card"}</SheetTitle>
					<SheetDescription className="sr-only">
						Every field saves as you go. Close to return to the board.
					</SheetDescription>

					{shown && (
						<>
							<div className="absolute top-4 right-14 flex items-center gap-1 max-sm:hidden">
								<Button asChild variant="ghost" size="icon" aria-label="Open as a page">
									<Link href={`/seiryu/${shown.projectId}/${shown.id}`} prefetch={false}>
										<HugeiconsIcon icon={SquareArrowUpRightIcon} className="h-4 w-4" />
									</Link>
								</Button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon" aria-label="Card actions">
											<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => onArchive(shown.id)}>
											<HugeiconsIcon icon={Archive01Icon} className="mr-2 h-4 w-4" />
											Archive
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="text-destructive focus:text-destructive"
											onClick={() => setConfirmDelete(true)}
										>
											<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
											Delete…
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							<div className="flex-1 overflow-y-auto px-4 pt-14 pb-10 [scrollbar-width:thin] sm:px-6 sm:pt-18">
								<CardDetail
									key={shown.id}
									card={shown}
									titleId={titleId}
									columns={columns}
									projectLabels={projectLabels}
									onSave={(updates) => onSave(shown.id, updates)}
									onMove={(columnId) => onMove(shown.id, columnId)}
									onChange={(updates) => onChange(shown.id, updates)}
									onProjectLabelsChange={onProjectLabelsChange}
								/>
							</div>

							{/* Phones: the card's actions sit under the thumb, not beside the close button. */}
							<div className="flex items-center gap-1 border-t border-rule px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:hidden">
								<Button asChild variant="ghost" className="gap-1.5 text-muted-foreground">
									<Link href={`/seiryu/${shown.projectId}/${shown.id}`} prefetch={false}>
										<HugeiconsIcon icon={SquareArrowUpRightIcon} className="h-4 w-4" />
										Page
									</Link>
								</Button>
								<Button
									variant="ghost"
									className="ml-auto gap-1.5 text-muted-foreground"
									onClick={() => onArchive(shown.id)}
								>
									<HugeiconsIcon icon={Archive01Icon} className="h-4 w-4" />
									Archive
								</Button>
								<Button
									variant="ghost"
									className="gap-1.5 text-destructive hover:text-destructive"
									onClick={() => setConfirmDelete(true)}
								>
									<HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
									Delete…
								</Button>
							</div>
						</>
					)}
				</SheetContent>
			</Sheet>

			<ConfirmDelete
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Delete "${shown?.title ?? "card"}"?`}
				description="The card, its checklist and labels go for good. To keep it out of the way instead, archive it."
				onConfirm={() => (shown ? onDelete(shown.id) : undefined)}
			/>
		</>
	);
}
