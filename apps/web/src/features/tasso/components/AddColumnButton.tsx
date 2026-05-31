"use client";

import { Spinner } from "@/components/Spinner";
import { createColumn } from "@/features/tasso/actions/columns";
import type { ColumnData } from "@/features/tasso/components/KanbanColumn";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	projectId: string;
	onColumnAdded: (column: ColumnData) => void;
}

export function AddColumnButton({ projectId, onColumnAdded }: Props) {
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState("");
	const [isCreating, startCreate] = useTransition();

	function open() {
		setAdding(true);
		setName("");
	}

	function cancel() {
		setAdding(false);
		setName("");
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		startCreate(async () => {
			const result = await createColumn({ projectId, name: trimmed });
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			onColumnAdded({
				id: result.data.id,
				projectId,
				name: trimmed,
				color: null,
				position: result.data.position,
			});
			cancel();
			toast.success("Column added");
		});
	}

	if (!adding) {
		return (
			<div className="flex w-64 shrink-0 items-start">
				<button
					type="button"
					onClick={open}
					className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-border/60 hover:bg-accent hover:text-foreground"
				>
					<span className="text-base leading-none">+</span>
					Add column
				</button>
			</div>
		);
	}

	return (
		<div className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/40 px-3 py-3">
			<form onSubmit={handleSubmit} className="flex flex-col gap-2">
				<input
					autoFocus
					value={name}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Escape") cancel();
					}}
					placeholder="Column name…"
					className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				/>
				<div className="flex items-center gap-1.5">
					<button
						type="submit"
						disabled={isCreating || !name.trim()}
						className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
					>
						{isCreating && <Spinner className="h-3 w-3" />}
						{isCreating ? "Adding…" : "Add column"}
					</button>
					<button
						type="button"
						onClick={cancel}
						className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	);
}
