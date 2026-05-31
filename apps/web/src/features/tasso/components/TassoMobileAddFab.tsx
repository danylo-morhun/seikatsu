"use client";

import { Spinner } from "@/components/Spinner";
import { createCard } from "@/features/tasso/actions/cards";
import type { CardData } from "@/features/tasso/components/KanbanCard";
import type { ColumnData } from "@/features/tasso/components/KanbanColumn";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ethos/ui";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	columns: ColumnData[];
	projectId: string;
	onCardAdded: (card: CardData) => void;
}

export function TassoMobileAddFab({ columns, projectId, onCardAdded }: Props) {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [columnId, setColumnId] = useState<string>("");
	const [isPending, startTransition] = useTransition();

	const sortedColumns = [...columns].sort((a, b) => (a.position < b.position ? -1 : 1));

	function handleOpen(val: boolean) {
		setOpen(val);
		if (val && !columnId && sortedColumns[0]) {
			setColumnId(sortedColumns[0].id);
		}
		if (!val) {
			setTitle("");
		}
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = title.trim();
		if (!trimmed || !columnId) return;

		startTransition(async () => {
			const result = await createCard({ columnId, projectId, title: trimmed });
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			onCardAdded({
				id: result.data.id,
				columnId,
				projectId,
				title: trimmed,
				description: null,
				priority: null,
				dueDate: null,
				position: result.data.position,
				checklistItems: [],
				labels: [],
			});
			setTitle("");
			setOpen(false);
			toast.success("Card created");
		});
	}

	if (sortedColumns.length === 0) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 md:hidden">
			<Dialog open={open} onOpenChange={handleOpen}>
				<DialogTrigger asChild>
					<Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
						<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Add card</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
						<Select value={columnId} onValueChange={setColumnId}>
							<SelectTrigger>
								<SelectValue placeholder="Select column" />
							</SelectTrigger>
							<SelectContent>
								{sortedColumns.map((col) => (
									<SelectItem key={col.id} value={col.id}>
										{col.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<textarea
							autoFocus
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Card title…"
							rows={3}
							className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>

						<Button type="submit" disabled={isPending || !title.trim() || !columnId} className="gap-1.5">
							{isPending && <Spinner className="h-3.5 w-3.5" />}
							{isPending ? "Adding…" : "Add card"}
						</Button>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
