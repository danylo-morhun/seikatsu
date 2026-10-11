"use client";

import { Spinner } from "@/components/Spinner";
import {
	archiveCard,
	deleteCard,
	moveCard,
	restoreCard,
	updateCard,
} from "@/features/seiryu/actions/cards";
import { CardDetail } from "@/features/seiryu/components/CardDetail";
import { ConfirmDelete } from "@/features/seiryu/components/ConfirmDelete";
import type {
	ActionResult,
	CardData,
	CardFieldUpdates,
	LabelData,
} from "@/features/seiryu/lib/types";
import {
	Archive01Icon,
	ArrowLeft01Icon,
	Delete01Icon,
	MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	card: CardData & { archivedAt: Date | null };
	projectName: string;
	columns: { id: string; name: string }[];
	projectLabels: LabelData[];
	today: string;
}

/** A card on its own page (deep link, new tab): the sheet's body, under a back link. */
export function CardPage({
	card: initial,
	projectName,
	columns,
	projectLabels: initialLabels,
	today,
}: Props) {
	const router = useRouter();
	const [card, setCard] = useState(initial);
	const [projectLabels, setProjectLabels] = useState(initialLabels);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [isRestoring, startRestore] = useTransition();
	const boardHref = `/seiryu/${card.projectId}`;
	const archived = card.archivedAt !== null;

	async function persist(changes: Partial<CardData>, save: Promise<ActionResult>) {
		const before = card;
		setCard((c) => ({ ...c, ...changes }));
		const result = await save;
		if ("error" in result) {
			toast.error(result.error);
			setCard(before);
		}
	}

	function handleSave(updates: CardFieldUpdates) {
		persist(updates, updateCard({ cardId: card.id, ...updates }));
	}

	function handleMove(columnId: string) {
		persist({ columnId }, moveCard({ cardId: card.id, newColumnId: columnId }));
	}

	async function handleArchive() {
		const result = await archiveCard({ cardId: card.id });
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		router.push(boardHref);
	}

	function handleRestore() {
		startRestore(async () => {
			const result = await restoreCard({ cardId: card.id });
			if ("error" in result) toast.error(result.error);
			else setCard((c) => ({ ...c, archivedAt: null, position: result.data.position }));
		});
	}

	async function handleDelete() {
		const result = await deleteCard({ cardId: card.id });
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		router.push(boardHref);
	}

	return (
		<div className="h-full overflow-y-auto">
			<div className="max-w-2xl px-4 pt-6 pb-28 sm:px-8 md:pt-8 md:pb-8">
				<div className="mb-6 flex items-center justify-between gap-4">
					<Link
						href={boardHref}
						prefetch
						className="inline-flex min-w-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden className="size-4 shrink-0" />
						<span className="truncate">{projectName}</span>
					</Link>
					{!archived && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" aria-label="Card actions">
									<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleArchive}>
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
					)}
				</div>

				<h1 className="sr-only">{card.title}</h1>

				{archived && (
					<div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-y border-rule py-3">
						<p className="text-sm text-muted-foreground">
							Archived — hidden from the board. Restore it to edit.
						</p>
						<div className="flex gap-2">
							<Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
								Delete
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="gap-1.5"
								disabled={isRestoring}
								onClick={handleRestore}
							>
								{isRestoring && <Spinner />}
								{isRestoring ? "Restoring…" : "Restore"}
							</Button>
						</div>
					</div>
				)}

				<CardDetail
					card={card}
					columns={columns}
					projectLabels={projectLabels}
					readOnly={archived}
					today={today}
					onSave={handleSave}
					onMove={handleMove}
					onChange={(changes) => setCard((c) => ({ ...c, ...changes }))}
					onProjectLabelsChange={setProjectLabels}
				/>
			</div>

			<ConfirmDelete
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Delete "${card.title}"?`}
				description="The card, its checklist and labels go for good."
				onConfirm={handleDelete}
			/>
		</div>
	);
}
