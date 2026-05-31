"use client";

import { archiveCard, updateCard } from "@/features/tasso/actions/cards";
import { type CardData } from "@/features/tasso/components/KanbanCard";
import { Spinner } from "@/components/Spinner";
import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@ethos/ui";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

type Priority = "low" | "medium" | "high" | "urgent";

interface Props {
	card: CardData | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onUpdate?: (
		cardId: string,
		updates: Partial<Pick<CardData, "title" | "description" | "priority" | "dueDate">>,
	) => void;
	onArchive?: (cardId: string) => void;
}

export function CardSheet({ card, open, onOpenChange, onUpdate, onArchive }: Props) {
	const [title, setTitle] = useState(card?.title ?? "");
	const [description, setDescription] = useState(card?.description ?? "");
	const [priority, setPriority] = useState<Priority | "">(card?.priority ?? "");
	const [dueDate, setDueDate] = useState(card?.dueDate ?? "");
	const [isSaving, startSave] = useTransition();
	const [isArchiving, startArchive] = useTransition();

	useEffect(() => {
		if (card) {
			setTitle(card.title);
			setDescription(card.description ?? "");
			setPriority(card.priority ?? "");
			setDueDate(card.dueDate ?? "");
		}
	}, [card?.id]);

	function handleSave() {
		if (!card) return;
		const resolvedTitle = title.trim() || card.title;
		const resolvedPriority = (priority || null) as Priority | null;
		const resolvedDueDate = dueDate || null;
		const resolvedDescription = description || null;

		startSave(async () => {
			const result = await updateCard({
				cardId: card.id,
				title: resolvedTitle,
				description: resolvedDescription,
				priority: resolvedPriority,
				dueDate: resolvedDueDate,
			});
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			toast.success("Card updated");
			onUpdate?.(card.id, {
				title: resolvedTitle,
				description: resolvedDescription,
				priority: resolvedPriority,
				dueDate: resolvedDueDate,
			});
		});
	}

	function handleArchive() {
		if (!card) return;
		startArchive(async () => {
			const result = await archiveCard({ cardId: card.id });
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			toast.success("Card archived");
			onArchive?.(card.id);
			onOpenChange(false);
		});
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="flex flex-col gap-0 p-0">
				<SheetTitle className="sr-only">Card details</SheetTitle>
				<SheetDescription className="sr-only">Edit card fields</SheetDescription>
				<SheetHeader className="px-6 pt-6 pb-4">
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
						placeholder="Card title"
					/>
					{card && (
						<Link
							href={`/tasso/${card.projectId}/${card.id}`}
							target="_blank"
							className="mt-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							Open in new tab →
						</Link>
					)}
				</SheetHeader>

				<Separator />

				<div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
					<div className="flex flex-col gap-2">
						<Label className="text-xs text-muted-foreground">Priority</Label>
						<Select
							value={priority || "none"}
							onValueChange={(v) => setPriority(v === "none" ? "" : (v as Priority))}
						>
							<SelectTrigger className="h-8 text-xs">
								<SelectValue placeholder="No priority" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No priority</SelectItem>
								<SelectItem value="low">Low</SelectItem>
								<SelectItem value="medium">Medium</SelectItem>
								<SelectItem value="high">High</SelectItem>
								<SelectItem value="urgent">Urgent</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-2">
						<Label className="text-xs text-muted-foreground">Due date</Label>
						<input
							type="date"
							value={dueDate}
							onChange={(e) => setDueDate(e.target.value)}
							className="h-8 w-full rounded-md border border-input bg-transparent px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label className="text-xs text-muted-foreground">Description</Label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Add a description…"
							rows={5}
							className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
				</div>

				<Separator />

				<div className="flex items-center justify-between px-6 py-4">
					<button
						type="button"
						disabled={isArchiving}
						onClick={handleArchive}
						className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
					>
						{isArchiving && <Spinner className="h-3 w-3" />}
						Archive card
					</button>

					<button
						type="button"
						disabled={isSaving || !title.trim()}
						onClick={handleSave}
						className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
					>
						{isSaving && <Spinner className="h-3 w-3" />}
						{isSaving ? "Saving…" : "Save"}
					</button>
				</div>
			</SheetContent>
		</Sheet>
	);
}
