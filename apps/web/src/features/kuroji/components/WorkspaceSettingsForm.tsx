"use client";

import { Spinner } from "@/components/Spinner";
import { updateWorkspace } from "@/features/kuroji/actions/workspace";
import { CURRENCIES } from "@/features/kuroji/lib/constants";
import { Button, Input, Label } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
	workspaceId: string;
	initialName: string;
	baseCurrency: string;
}

export function WorkspaceSettingsForm({ workspaceId, initialName, baseCurrency }: Props) {
	const [name, setName] = useState(initialName);
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		startTransition(async () => {
			const result = await updateWorkspace(workspaceId, { name });
			if ("error" in result) {
				toast.error(result.error);
			} else {
				toast.success("Workspace updated.");
				router.refresh();
			}
		});
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="ws-name">Workspace name</Label>
				<Input
					id="ws-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="My Workspace"
					className="max-w-sm"
				/>
			</div>
			<div className="space-y-2">
				<Label>Base currency</Label>
				<div className="flex items-center gap-2">
					<span className="rounded-md border px-3 py-2 text-sm font-mono">{baseCurrency}</span>
					<span className="text-xs text-muted-foreground">Currency change not yet supported</span>
				</div>
			</div>
			<Button type="submit" disabled={isPending || name.trim() === initialName} className="gap-1.5">
				{isPending && <Spinner />}
				{isPending ? "Saving…" : "Save changes"}
			</Button>
		</form>
	);
}
