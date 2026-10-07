"use client";

import type { ColumnData } from "@/features/seiryu/components/KanbanColumn";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
} from "@seikatsu/ui";
import { useState } from "react";

interface Props {
	/** Sorted by position. */
	columns: ColumnData[];
	onAddCard: (columnId: string, title: string) => void;
}

export function SeiryuMobileAddFab({ columns: sortedColumns, onAddCard }: Props) {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [columnId, setColumnId] = useState<string>("");

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

		onAddCard(columnId, trimmed);
		setTitle("");
		setOpen(false);
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

						<Button type="submit" disabled={!title.trim() || !columnId}>
							Add card
						</Button>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
