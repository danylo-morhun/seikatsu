"use client";

import { Spinner } from "@/components/Spinner";
import { setBookShelves } from "@/features/tsundoku/actions/books";
import { createShelf } from "@/features/tsundoku/actions/shelves";
import type { TsundokuShelf } from "@/features/tsundoku/actions/shelves";
import { SHELF_COLORS } from "@/features/tsundoku/lib/constants";
import { Add01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, cn } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function ShelfManager({
	bookId,
	workspaceId,
	shelves,
	bookShelfIds,
}: {
	bookId: string;
	workspaceId: string;
	shelves: TsundokuShelf[];
	bookShelfIds: string[];
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [showCreate, setShowCreate] = useState(false);

	const selected = new Set(bookShelfIds);

	function toggle(shelfId: string) {
		const next = new Set(selected);
		if (next.has(shelfId)) next.delete(shelfId);
		else next.add(shelfId);
		setBusyId(shelfId);
		startTransition(async () => {
			const res = await setBookShelves(bookId, Array.from(next));
			setBusyId(null);
			if ("error" in res) toast.error(res.error);
			else router.refresh();
		});
	}

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!newName.trim()) return;
		setCreating(true);
		const color = SHELF_COLORS[shelves.length % SHELF_COLORS.length];
		const res = await createShelf(workspaceId, { name: newName.trim(), color });
		setCreating(false);
		if ("error" in res) {
			toast.error(res.error);
			return;
		}
		setNewName("");
		setShowCreate(false);
		router.refresh();
	}

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-1.5">
				{shelves.map((s) => {
					const on = selected.has(s.id);
					return (
						<button
							key={s.id}
							type="button"
							onClick={() => toggle(s.id)}
							disabled={isPending && busyId === s.id}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
								on
									? "border-primary bg-primary/10 text-primary"
									: "border-border text-muted-foreground hover:bg-accent/50",
							)}
						>
							{s.color && (
								<span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
							)}
							{s.name}
							{isPending && busyId === s.id ? (
								<Spinner />
							) : on ? (
								<HugeiconsIcon icon={Tick02Icon} className="h-3 w-3" />
							) : null}
						</button>
					);
				})}
				{!showCreate && (
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent/50"
					>
						<HugeiconsIcon icon={Add01Icon} className="h-3 w-3" />
						New shelf
					</button>
				)}
			</div>
			{showCreate && (
				<form onSubmit={onCreate} className="flex items-center gap-2">
					<Input
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						placeholder="Shelf name"
						className="h-8 w-40"
						autoFocus
					/>
					<Button type="submit" size="sm" disabled={creating} className="gap-1.5">
						{creating && <Spinner />}
						Create
					</Button>
					<Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
						Cancel
					</Button>
				</form>
			)}
		</div>
	);
}
