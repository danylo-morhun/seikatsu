"use client";

import { Spinner } from "@/components/Spinner";
import { archiveCard, updateCard } from "@/features/tasso/actions/cards";
import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
} from "@ethos/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Priority = "low" | "medium" | "high" | "urgent";

interface CardProps {
	id: string;
	projectId: string;
	title: string;
	description: string | null;
	priority: Priority | null;
	dueDate: string | null;
}

interface Props {
	card: CardProps;
	projectId: string;
}

export function CardPage({ card, projectId }: Props) {
	const router = useRouter();
	const [title, setTitle] = useState(card.title);
	const [description, setDescription] = useState(card.description ?? "");
	const [priority, setPriority] = useState<Priority | "">(card.priority ?? "");
	const [dueDate, setDueDate] = useState(card.dueDate ?? "");
	const [isSaving, startSave] = useTransition();
	const [isArchiving, startArchive] = useTransition();

	function handleSave() {
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
			if ("error" in result) toast.error(result.error);
			else toast.success("Card updated");
		});
	}

	function handleArchive() {
		startArchive(async () => {
			const result = await archiveCard({ cardId: card.id });
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			toast.success("Card archived");
			router.push(`/tasso/${projectId}`);
		});
	}

	return (
		<div className="mx-auto flex h-full max-w-2xl flex-col px-6 py-8">
			<Link
				href={`/tasso/${projectId}`}
				className="mb-6 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				← Back to board
			</Link>

			<div className="flex flex-col gap-6">
				<input
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className="w-full bg-transparent text-lg font-medium text-foreground outline-none placeholder:text-muted-foreground"
					placeholder="Card title"
				/>

				<Separator />

				<div className="flex flex-col gap-5">
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
							rows={8}
							className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
				</div>

				<Separator />

				<div className="flex items-center justify-between">
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
			</div>
		</div>
	);
}
