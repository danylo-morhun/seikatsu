"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Spinner } from "@/components/Spinner";
import { createFund, deleteFund, updateFund } from "@/features/kuroji/actions/plan";
import { parseAmount } from "@/features/kuroji/lib/transaction-schema";
import { NEEDS_CONNECTION, offlineError } from "@/features/pwa/lib/run";
import { useKeptDraft } from "@/hooks/useKeptDraft";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

export type FundTarget = {
	id: string;
	name: string;
	target: number;
	dueDate: string;
	accountId: string;
};

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workspaceId: string;
	/** null = a new fund. */
	fund: FundTarget | null;
	accounts: { id: string; name: string }[];
}

/** A dated goal (a trip) whose money sits in an asset account. */
export function FundDialog({ open, onOpenChange, workspaceId, fund, accounts }: Props) {
	const [name, setName] = useState("");
	const [target, setTarget] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [accountId, setAccountId] = useState("");
	const [confirming, setConfirming] = useState(false);
	const [pending, startTransition] = useTransition();
	// A new fund's draft survives Escape or a click outside.
	const draft = useKeptDraft();

	useEffect(() => {
		if (!open || draft.resume(!fund)) return;
		setName(fund?.name ?? "");
		setTarget(fund ? String(Math.round(fund.target)) : "");
		setDueDate(fund?.dueDate ?? "");
		// A new fund goes where the others are; most people keep one travel account.
		setAccountId(fund?.accountId ?? (accounts.length === 1 ? accounts[0].id : ""));
	}, [open, fund, accounts]);

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const amount = parseAmount(target);
		if (!name.trim() || amount == null || amount <= 0 || !dueDate || !accountId) {
			toast.error("Fill in the name, amount, date and account");
			return;
		}
		const input = { name: name.trim(), target: amount, dueDate, accountId };
		startTransition(async () => {
			const result =
				offlineError() ??
				(await (fund ? updateFund(fund.id, input) : createFund(workspaceId, input)).catch(() => ({
					error: NEEDS_CONNECTION,
				})));
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			onOpenChange(false);
		});
	}

	return (
		<>
			<Dialog
				open={open && !confirming}
				onOpenChange={(v) => {
					if (!v) draft.keep(!fund);
					onOpenChange(v);
				}}
			>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>{fund ? fund.name : "New fund"}</DialogTitle>
						<DialogDescription>
							Money put aside by a date. The plan works out what to transfer each month.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={onSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="fund-name">Name</Label>
							<Input
								id="fund-name"
								autoComplete="off"
								placeholder="Tatry"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label htmlFor="fund-target">Amount</Label>
								<Input
									id="fund-target"
									type="text"
									inputMode="decimal"
									autoComplete="off"
									value={target}
									onChange={(e) => setTarget(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="fund-date">By</Label>
								<Input
									id="fund-date"
									type="date"
									value={dueDate}
									onChange={(e) => setDueDate(e.target.value)}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="fund-account">Kept in</Label>
							<Select value={accountId} onValueChange={setAccountId}>
								<SelectTrigger id="fund-account">
									<SelectValue placeholder="Choose an account" />
								</SelectTrigger>
								<SelectContent>
									{accounts.map((a) => (
										<SelectItem key={a.id} value={a.id}>
											{a.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-center justify-between gap-2 pt-2">
							{fund ? (
								<Button
									type="button"
									variant="ghost"
									className="text-destructive hover:text-destructive"
									disabled={pending}
									onClick={() => setConfirming(true)}
								>
									Delete
								</Button>
							) : (
								<span />
							)}
							<Button type="submit" disabled={pending} className="gap-1.5">
								{pending && <Spinner />}
								{pending ? "Saving…" : "Save"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{fund && (
				<ConfirmDelete
					open={confirming}
					onOpenChange={setConfirming}
					title={`Delete ${fund.name}?`}
					description="The money stays in its account; only the goal goes."
					onConfirm={async () => {
						const result =
							offlineError() ??
							(await deleteFund(fund.id).catch(() => ({ error: NEEDS_CONNECTION })));
						if ("error" in result) {
							toast.error(result.error);
							return;
						}
						setConfirming(false);
						onOpenChange(false);
					}}
				/>
			)}
		</>
	);
}
