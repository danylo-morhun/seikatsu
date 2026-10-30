"use client";

import { ColorSwatches } from "@/components/ColorSwatches";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Spinner } from "@/components/Spinner";
import { deleteLabel, updateLabel } from "@/features/seiryu/actions/labels";
import { Delete01Icon, MoreHorizontalIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	Label,
} from "@seikatsu/ui";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

type Row = {
	id: string;
	name: string;
	color: string;
	projectId: string;
	projectName: string;
	cardCount: number;
};

/** Labels grouped by project, as Kuroji groups accounts: name, colour, how many cards use it. */
export function SettingsLabels({ labels }: { labels: Row[] }) {
	const [editing, setEditing] = useState<Row | null>(null);
	const [deleting, setDeleting] = useState<Row | null>(null);

	if (labels.length === 0) {
		return (
			<p className="py-4 text-sm text-muted-foreground">
				No labels yet. Make them from a card, under Labels.
			</p>
		);
	}

	const groups = new Map<string, { name: string; rows: Row[] }>();
	for (const label of labels) {
		const group = groups.get(label.projectId);
		if (group) group.rows.push(label);
		else groups.set(label.projectId, { name: label.projectName, rows: [label] });
	}

	return (
		<div className="space-y-10">
			{[...groups.entries()].map(([projectId, group], gi) => (
				<section
					key={projectId}
					aria-label={group.name}
					className="animate-rise"
					style={{ "--i": gi } as React.CSSProperties}
				>
					<h3 className="mb-2 text-sm font-semibold">{group.name}</h3>
					<ul className="inset-group rounded-2xl bg-surface px-4 py-2 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent">
						{group.rows.map((label) => (
							<li key={label.id} className="flex items-center gap-3 py-2.5">
								<span
									aria-hidden
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: label.color }}
								/>
								<span className="min-w-0 flex-1 truncate text-sm">{label.name}</span>
								<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
									{label.cardCount} {label.cardCount === 1 ? "card" : "cards"}
								</span>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="size-10 text-muted-foreground/50 md:size-8 hover:text-foreground"
											aria-label={`Actions for ${label.name}`}
										>
											<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => setEditing(label)}>
											<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
											Edit
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="text-destructive focus:text-destructive"
											onClick={() => setDeleting(label)}
										>
											<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
											Delete…
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</li>
						))}
					</ul>
				</section>
			))}

			<LabelDialog label={editing} onOpenChange={(open) => !open && setEditing(null)} />
			<ConfirmDelete
				open={!!deleting}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete "${deleting?.name ?? ""}"?`}
				description={
					deleting && deleting.cardCount > 0
						? `It comes off ${deleting.cardCount} ${deleting.cardCount === 1 ? "card" : "cards"}; the cards stay.`
						: "No card uses it."
				}
				onConfirm={async () => {
					if (!deleting) return;
					const result = await deleteLabel({ labelId: deleting.id });
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</div>
	);
}

function LabelDialog({
	label,
	onOpenChange,
}: {
	label: Row | null;
	onOpenChange: (open: boolean) => void;
}) {
	const id = useId();
	const [name, setName] = useState("");
	const [color, setColor] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();

	useEffect(() => {
		if (!label) return;
		setName(label.name);
		setColor(label.color);
	}, [label]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!label || !name.trim()) return;
		startSave(async () => {
			const result = await updateLabel({
				labelId: label.id,
				name: name.trim(),
				...(color ? { color } : {}),
			});
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			onOpenChange(false);
		});
	}

	return (
		<Dialog open={!!label} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent className="sm:max-w-md max-sm:flex max-sm:flex-col">
				<DialogHeader>
					<DialogTitle>Edit Label</DialogTitle>
					<DialogDescription className="sr-only">
						Rename the label or change its colour.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-name`}>Name</Label>
						<Input
							id={`${id}-name`}
							value={name}
							maxLength={100}
							autoComplete="off"
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label>Colour</Label>
						<ColorSwatches value={color} onChange={setColor} label="Label colour" />
					</div>
					<div className="mt-auto flex justify-end gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4">
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="gap-1.5 max-sm:flex-1"
							disabled={isSaving || !name.trim()}
						>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
