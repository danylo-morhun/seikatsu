"use client";

import { Spinner } from "@/components/Spinner";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import { importPrivat24Statement } from "@/features/kuroji/actions/privat24-import";
import {
	Button,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];

export function Privat24ImportSection({
	workspaceId,
	accounts,
}: {
	workspaceId: string;
	accounts: Account[];
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [accountId, setAccountId] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const targets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");

	function handleSubmit() {
		if (!accountId) {
			toast.error("Pick an account to import into.");
			return;
		}
		if (!file) {
			toast.error("Choose a Privat24 .xlsx statement.");
			return;
		}
		const formData = new FormData();
		formData.set("workspaceId", workspaceId);
		formData.set("accountId", accountId);
		formData.set("file", file);

		startTransition(async () => {
			const result = await importPrivat24Statement(formData);
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			const opening = result.seededOpening ? " Opening balance seeded." : "";
			toast.success(
				`Imported ${result.imported} transaction(s), skipped ${result.skipped}.${opening}`,
			);
			setFile(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
			router.refresh();
		});
	}

	if (targets.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				Create an asset or liability account first, then import a statement into it.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1.5">
					<Label htmlFor="p24-account">Import into account</Label>
					<Select value={accountId} onValueChange={setAccountId}>
						<SelectTrigger id="p24-account">
							<SelectValue placeholder="Select account" />
						</SelectTrigger>
						<SelectContent>
							{targets.map((a) => (
								<SelectItem key={a.id} value={a.id}>
									{a.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="p24-file">Statement file (.xlsx)</Label>
					<Input
						id="p24-file"
						ref={fileInputRef}
						type="file"
						accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
						onChange={(e) => setFile(e.target.files?.[0] ?? null)}
						disabled={isPending}
					/>
				</div>
			</div>
			<Button onClick={handleSubmit} disabled={isPending} className="gap-1.5">
				{isPending && <Spinner />}
				{isPending ? "Importing…" : "Import statement"}
			</Button>
			<p className="text-xs text-muted-foreground">
				Export from the Privat24 app: card → Виписка → save as Excel. Import your oldest statement
				first so the opening balance is set correctly; re-importing the same file is safe
				(duplicates are skipped). Categories are auto-assigned by your import rules.
			</p>
		</div>
	);
}
