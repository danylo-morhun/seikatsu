"use client";

import { Spinner } from "@/components/Spinner";
import { createColumn } from "@/features/seiryu/actions/columns";
import { LANE } from "@/features/seiryu/components/KanbanColumn";
import type { ColumnData } from "@/features/seiryu/lib/types";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, cn } from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	projectId: string;
	onColumnAdded: (column: ColumnData) => void;
	className?: string;
}

/** The last lane: a quiet "Add column" that opens into a name field. */
export function AddColumnButton({ projectId, onColumnAdded, className }: Props) {
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState("");
	const [isCreating, startCreate] = useTransition();

	function close() {
		setAdding(false);
		setName("");
	}

	function handleSubmit(e: React.FormEvent) {
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
				isDone: false,
				position: result.data.position,
			});
			close();
		});
	}

	return (
		<div className={cn(LANE, !adding && "md:w-auto md:min-w-0 md:flex-none", className)}>
			{adding ? (
				<form onSubmit={handleSubmit} className="animate-swap space-y-2 pt-1">
					<Input
						autoFocus
						value={name}
						maxLength={100}
						autoComplete="off"
						aria-label="New column name"
						placeholder="Column name…"
						onChange={(e) => setName(e.target.value)}
						onBlur={() => !name.trim() && !isCreating && close()}
						onKeyDown={(e) => e.key === "Escape" && close()}
					/>
					<div className="flex gap-1.5">
						<Button
							type="submit"
							size="sm"
							className="gap-1.5"
							disabled={isCreating || !name.trim()}
						>
							{isCreating && <Spinner />}
							{isCreating ? "Adding…" : "Add column"}
						</Button>
						<Button type="button" size="sm" variant="ghost" onClick={close}>
							Cancel
						</Button>
					</div>
				</form>
			) : (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="inline-flex h-11 items-center gap-1.5 self-start rounded-md px-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				>
					<HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" />
					Add column
				</button>
			)}
		</div>
	);
}
