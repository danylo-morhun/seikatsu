"use client";

import { createTag } from "@/features/kuroji/actions/tags";
import type { Tag } from "@/features/kuroji/actions/tags";
import { Button, Input } from "@seikatsu/ui";
import * as React from "react";

const TAG_COLORS = [
	"#6366f1",
	"#f59e0b",
	"#10b981",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
	"#84cc16",
];

interface Props {
	workspaceId: string;
	tags: Tag[];
	selectedIds: string[];
	onToggle: (id: string) => void;
	onTagCreated: (tag: Tag) => void;
}

export function TagSelect({ workspaceId, tags, selectedIds, onToggle, onTagCreated }: Props) {
	const [newName, setNewName] = React.useState("");
	const [creating, setCreating] = React.useState(false);

	async function handleCreate() {
		const name = newName.trim();
		if (!name) return;
		setCreating(true);
		const color = TAG_COLORS[tags.length % TAG_COLORS.length];
		const result = await createTag(workspaceId, name, color);
		setCreating(false);
		if ("success" in result) {
			onTagCreated(result.tag);
			setNewName("");
		}
	}

	return (
		<div className="space-y-2">
			{tags.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{tags.map((tag) => {
						const isSelected = selectedIds.includes(tag.id);
						return (
							<button
								key={tag.id}
								type="button"
								onClick={() => onToggle(tag.id)}
								className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
									isSelected
										? "border-transparent text-white"
										: "border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-muted-foreground/60"
								}`}
								style={
									isSelected && tag.color
										? { backgroundColor: tag.color, borderColor: tag.color }
										: undefined
								}
							>
								{!isSelected && tag.color && (
									<span
										className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
										style={{ backgroundColor: tag.color }}
									/>
								)}
								{tag.name}
							</button>
						);
					})}
				</div>
			)}
			<div className="flex gap-1.5">
				<Input
					placeholder="New tag…"
					className="h-7 text-xs"
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							handleCreate();
						}
					}}
				/>
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="h-7 px-2 text-xs"
					disabled={creating || !newName.trim()}
					onClick={handleCreate}
				>
					{creating ? "…" : "+ Tag"}
				</Button>
			</div>
		</div>
	);
}
