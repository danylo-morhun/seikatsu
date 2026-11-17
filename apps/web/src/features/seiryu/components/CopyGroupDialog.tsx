"use client";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
} from "@seikatsu/ui";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { copyGroup } from "@/features/seiryu/actions/groups";
import type { GroupData } from "@/features/seiryu/lib/types";

interface Props {
	group: GroupData | null;
	/** The group's earliest due day on the board (archived cards aside), as a hint. */
	firstDue: string | null;
	onOpenChange: (open: boolean) => void;
	onCopied: (groupId: string) => void;
}

/** A group as a template: a name for the copy and the day its first card is due. */
export function CopyGroupDialog({ group, firstDue, onOpenChange, onCopied }: Props) {
	const id = useId();
	const [name, setName] = useState("");
	const [due, setDue] = useState("");
	const [pending, startCopy] = useTransition();

	useEffect(() => {
		if (!group) return;
		// "Black Week 2026" → "Black Week 2027"; otherwise "… (copy)".
		const year = /\b(20\d{2})\b/.exec(group.name)?.[1];
		setName(year ? group.name.replace(year, String(Number(year) + 1)) : `${group.name} (copy)`);
		setDue("");
	}, [group]);

	function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!group || !name.trim()) return;
		startCopy(async () => {
			const result = await copyGroup({
				groupId: group.id,
				name: name.trim(),
				...(due && { firstDue: due }),
			});
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			toast(`${name.trim()}: ${result.data.cards === 1 ? "1 card" : `${result.data.cards} cards`}`);
			onCopied(result.data.id);
			onOpenChange(false);
		});
	}

	return (
		<Dialog open={!!group} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Copy group</DialogTitle>
					<DialogDescription>
						Every card of {group?.name} again, open, with fresh checklists — its archived ones too.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-name`}>Name</Label>
						<Input
							id={`${id}-name`}
							value={name}
							maxLength={60}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${id}-due`}>First card due</Label>
						<Input
							id={`${id}-due`}
							type="date"
							value={due}
							onChange={(e) => setDue(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							The other dates keep their distance from it
							{firstDue ? ` (the first was ${firstDue})` : ""}. Empty: the same dates as before.
						</p>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" className="gap-1.5" disabled={pending || !name.trim()}>
							{pending && <Spinner />}
							{pending ? "Copying…" : "Copy"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
