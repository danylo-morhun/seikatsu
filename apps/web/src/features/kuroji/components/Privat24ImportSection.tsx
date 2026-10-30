"use client";

import { Spinner } from "@/components/Spinner";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import { importPrivat24Statement } from "@/features/kuroji/actions/privat24-import";
import { Xls01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	cn,
} from "@seikatsu/ui";
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
	const [isPending, startTransition] = useTransition();
	const [accountId, setAccountId] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const targets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");

	const ready = accountId !== "" && file !== null;

	function handleSubmit() {
		if (!file) return;
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
			const n = (k: number) => `${k} ${k === 1 ? "transaction" : "transactions"}`;
			const skipped = result.skipped ? ` · ${result.skipped} already here` : "";
			const opening = result.seededOpening ? " · opening balance set" : "";
			toast.success(`${n(result.imported)} imported${skipped}${opening}`);
			setFile(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
		});
	}

	if (targets.length === 0) {
		return (
			<p className="py-4 text-sm text-muted-foreground">
				Add the card as an account under Accounts first, then import its statement into it.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2">
				{/* grid, not space-y: Radix puts a hidden <select> after the trigger. */}
				<div className="grid gap-2">
					<Label htmlFor="p24-account">Into account</Label>
					<Select value={accountId} onValueChange={setAccountId}>
						<SelectTrigger id="p24-account">
							<SelectValue placeholder="Pick the card" />
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
				<div className="space-y-2">
					<Label htmlFor="p24-file">Statement</Label>
					<input
						id="p24-file"
						ref={fileInputRef}
						type="file"
						accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
						className="sr-only"
						onChange={(e) => setFile(e.target.files?.[0] ?? null)}
						disabled={isPending}
					/>
					{/* The native picker can't be styled; this stands in for it and opens it. */}
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						disabled={isPending}
						aria-describedby="p24-hint"
						className="flex h-10 w-full items-center gap-2 rounded-field border border-input px-3 md:h-9 text-left text-base outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:text-sm"
					>
						<HugeiconsIcon icon={Xls01Icon} className="size-4 shrink-0 text-muted-foreground" />
						<span className={cn("truncate", !file && "text-muted-foreground")}>
							{file ? file.name : "Choose the .xlsx"}
						</span>
					</button>
				</div>
			</div>
			<Button
				onClick={handleSubmit}
				variant={ready ? "default" : "outline"}
				disabled={isPending || !ready}
				className="gap-1.5"
			>
				{isPending && <Spinner />}
				{isPending ? "Importing…" : "Import statement"}
			</Button>
			<p id="p24-hint" className="max-w-prose text-xs text-muted-foreground">
				In Privat24: the card → Виписка → save as Excel. Start with the oldest statement so the
				opening balance comes out right. The same file twice is fine; repeats are skipped. Import
				rules pick the categories.
			</p>
		</div>
	);
}
