"use client";

import { Spinner } from "@/components/Spinner";
import type { AishaItem } from "@/features/aisha/actions/data";
import { createItem, deleteItem, updateItem } from "@/features/aisha/actions/items";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Label,
} from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

function toInt(v: string): number | null {
	const n = Number.parseInt(v.replace(/\s/g, ""), 10);
	return Number.isFinite(n) ? n : null;
}

/** Create (no `item`) or edit (with `item`) a maintenance item. */
export function ItemModal({
	vehicleId,
	item,
	trigger,
}: {
	vehicleId: string;
	item?: AishaItem;
	trigger: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const [deleting, startDelete] = useTransition();
	const [name, setName] = useState(item?.name ?? "");
	const [intervalKm, setIntervalKm] = useState(item?.intervalKm?.toString() ?? "");
	const [intervalMonths, setIntervalMonths] = useState(item?.intervalMonths?.toString() ?? "");
	const [note, setNote] = useState(item?.note ?? "");

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const values = {
			name,
			intervalKm: toInt(intervalKm),
			intervalMonths: toInt(intervalMonths),
			note,
		};
		startTransition(async () => {
			const res = item ? await updateItem(item.id, values) : await createItem(vehicleId, values);
			if ("error" in res) {
				toast.error(res.error);
				return;
			}
			toast.success(item ? "Saved." : "Item added.");
			setOpen(false);
			if (!item) {
				setName("");
				setIntervalKm("");
				setIntervalMonths("");
				setNote("");
			}
		});
	}

	function onDelete() {
		if (!item || !confirm(`Delete "${item.name}"? Its history in past services is removed too.`))
			return;
		startDelete(async () => {
			const res = await deleteItem(item.id);
			if ("error" in res) {
				toast.error(res.error);
				return;
			}
			toast.success("Deleted.");
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{item ? "Edit item" : "New maintenance item"}</DialogTitle>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="space-y-1.5">
						<Label htmlFor="i-name">Name</Label>
						<Input
							id="i-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Timing belt"
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="i-km">Every (km)</Label>
							<Input
								id="i-km"
								inputMode="numeric"
								value={intervalKm}
								onChange={(e) => setIntervalKm(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="i-months">Every (months)</Label>
							<Input
								id="i-months"
								inputMode="numeric"
								value={intervalMonths}
								onChange={(e) => setIntervalMonths(e.target.value)}
							/>
						</div>
					</div>
					<p className="text-xs text-muted-foreground">
						Due at whichever comes first. Leave one empty to ignore it.
					</p>
					<div className="space-y-1.5">
						<Label htmlFor="i-note">Note</Label>
						<Input id="i-note" value={note} onChange={(e) => setNote(e.target.value)} />
					</div>
					<div className="flex items-center justify-between gap-2 pt-1">
						{item ? (
							<Button
								type="button"
								variant="ghost"
								className="gap-1.5 text-destructive"
								disabled={deleting}
								onClick={onDelete}
							>
								{deleting && <Spinner />}
								Delete
							</Button>
						) : (
							<span />
						)}
						<div className="flex gap-2">
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={pending} className="gap-1.5">
								{pending && <Spinner />}
								{pending ? "Saving…" : "Save"}
							</Button>
						</div>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
