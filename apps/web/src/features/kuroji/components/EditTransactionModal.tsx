"use client";

import { Spinner } from "@/components/Spinner";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getTags } from "@/features/kuroji/actions/tags";
import type { Tag } from "@/features/kuroji/actions/tags";
import { updateTransaction } from "@/features/kuroji/actions/transactions";
import type { RecentTransaction } from "@/features/kuroji/actions/transactions";
import { AccountSelect } from "@/features/kuroji/components/AccountSelect";
import { TagSelect } from "@/features/kuroji/components/TagSelect";
import { CURRENCIES, toCurrency } from "@/features/kuroji/lib/constants";
import {
	type TransactionFormValues,
	type TxType,
	transactionFormSchema,
} from "@/features/kuroji/lib/transaction-schema";
import { useRefreshRouter } from "@/hooks/useRefreshRouter";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@seikatsu/ui";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];

function inferTxType(txn: RecentTransaction): TxType {
	if (txn.toAccountType === "EXPENSE") return "expense";
	if (txn.fromAccountType === "INCOME") return "income";
	return "transfer";
}

function buildDefaults(type: TxType, txn: RecentTransaction): TransactionFormValues {
	const base = {
		description: txn.description ?? undefined,
		amount: Math.abs(Number(txn.amount)),
		currency: toCurrency(txn.currency),
		date: txn.date,
	};
	if (type === "expense")
		return { ...base, txType: "expense", walletId: txn.fromAccountId, categoryId: txn.toAccountId };
	if (type === "income")
		return { ...base, txType: "income", categoryId: txn.fromAccountId, walletId: txn.toAccountId };
	return {
		...base,
		txType: "transfer",
		fromWalletId: txn.fromAccountId,
		toWalletId: txn.toAccountId,
	};
}

interface Props {
	transaction: RecentTransaction;
	workspaceId: string;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}

export function EditTransactionModal({ transaction, workspaceId, open, onOpenChange }: Props) {
	const refresh = useRefreshRouter();
	const [accounts, setAccounts] = React.useState<Account[]>([]);
	const [workspaceTags, setWorkspaceTags] = React.useState<Tag[]>([]);
	const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>(() =>
		transaction.tags.map((t) => t.id),
	);
	const [txType, setTxType] = React.useState<TxType>(() => inferTxType(transaction));

	const wallets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");
	const expenseCategories = accounts.filter((a) => a.type === "EXPENSE");
	const incomeCategories = accounts.filter((a) => a.type === "INCOME");

	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<TransactionFormValues>({
		resolver: zodResolver(transactionFormSchema),
		defaultValues: buildDefaults(txType, transaction) as unknown as TransactionFormValues,
	});

	React.useEffect(() => {
		if (open) {
			getAccounts(workspaceId).then(setAccounts);
			getTags(workspaceId).then(setWorkspaceTags);
			setSelectedTagIds(transaction.tags.map((t) => t.id));
		}
	}, [open, workspaceId, transaction]);

	const handleTabChange = (val: string) => {
		const next = val as TxType;
		setTxType(next);
		reset(buildDefaults(next, transaction) as unknown as TransactionFormValues);
	};

	const onSubmit = async (values: TransactionFormValues) => {
		let fromAccountId: string;
		let toAccountId: string;
		if (values.txType === "expense") {
			fromAccountId = values.walletId;
			toAccountId = values.categoryId;
		} else if (values.txType === "income") {
			fromAccountId = values.categoryId;
			toAccountId = values.walletId;
		} else {
			fromAccountId = values.fromWalletId;
			toAccountId = values.toWalletId;
		}

		const result = await updateTransaction({
			transactionId: transaction.id,
			fromAccountId,
			toAccountId,
			amount: values.amount,
			currency: values.currency,
			description: values.description,
			date: values.date,
			tagIds: selectedTagIds,
		});

		if ("error" in result) {
			toast.error(result.error);
		} else {
			toast.success("Transaction updated.");
			refresh();
			onOpenChange(false);
		}
	};

	const errs = errors as Record<string, { message?: string }>;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Transaction</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<Tabs value={txType} onValueChange={handleTabChange} className="w-full">
						<TabsList className="w-full">
							<TabsTrigger value="expense" className="flex-1">
								Expense
							</TabsTrigger>
							<TabsTrigger value="income" className="flex-1">
								Income
							</TabsTrigger>
							<TabsTrigger value="transfer" className="flex-1">
								Transfer
							</TabsTrigger>
						</TabsList>

						<TabsContent value="expense" className="space-y-4">
							<div className="space-y-2">
								<Label>Wallet</Label>
								<AccountSelect
									control={control as never}
									name="walletId"
									accounts={wallets}
									placeholder="Select wallet"
									error={errs.walletId?.message}
								/>
							</div>
							<div className="space-y-2">
								<Label>Category</Label>
								<AccountSelect
									control={control as never}
									name="categoryId"
									accounts={expenseCategories}
									placeholder="Select expense category"
									error={errs.categoryId?.message}
								/>
							</div>
						</TabsContent>

						<TabsContent value="income" className="space-y-4">
							<div className="space-y-2">
								<Label>Category</Label>
								<AccountSelect
									control={control as never}
									name="categoryId"
									accounts={incomeCategories}
									placeholder="Select income category"
									error={errs.categoryId?.message}
								/>
							</div>
							<div className="space-y-2">
								<Label>Wallet</Label>
								<AccountSelect
									control={control as never}
									name="walletId"
									accounts={wallets}
									placeholder="Select wallet"
									error={errs.walletId?.message}
								/>
							</div>
						</TabsContent>

						<TabsContent value="transfer" className="space-y-4">
							<div className="space-y-2">
								<Label>From Wallet</Label>
								<AccountSelect
									control={control as never}
									name="fromWalletId"
									accounts={wallets}
									placeholder="Select source wallet"
									error={errs.fromWalletId?.message}
								/>
							</div>
							<div className="space-y-2">
								<Label>To Wallet</Label>
								<AccountSelect
									control={control as never}
									name="toWalletId"
									accounts={wallets}
									placeholder="Select destination wallet"
									error={errs.toWalletId?.message}
								/>
							</div>
						</TabsContent>
					</Tabs>

					<div className="space-y-2">
						<Label htmlFor="edit-description">Description</Label>
						<Input
							id="edit-description"
							placeholder="e.g. Grocery run"
							{...register("description")}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-amount">Amount</Label>
						<div className="flex gap-2">
							<Input
								id="edit-amount"
								type="number"
								step="0.01"
								placeholder="0.00"
								className="flex-1"
								{...register("amount", { valueAsNumber: true })}
							/>
							<Controller
								control={control as never}
								name="currency"
								render={({
									field,
								}: { field: { onChange: (v: string) => void; value: string } }) => (
									<Select
										onValueChange={field.onChange}
										value={field.value ?? toCurrency(transaction.currency)}
									>
										<SelectTrigger className="w-[90px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{CURRENCIES.map((c) => (
												<SelectItem key={c} value={c}>
													{c}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						{errs.amount && <p className="text-destructive text-[0.8rem]">{errs.amount.message}</p>}
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-date">Date</Label>
						<Input id="edit-date" type="date" {...register("date")} />
						{errs.date && <p className="text-destructive text-[0.8rem]">{errs.date.message}</p>}
					</div>

					<div className="space-y-2">
						<Label>Tags</Label>
						<TagSelect
							workspaceId={workspaceId}
							tags={workspaceTags}
							selectedIds={selectedTagIds}
							onToggle={(id) =>
								setSelectedTagIds((prev) =>
									prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
								)
							}
							onTagCreated={(tag) => {
								setWorkspaceTags((prev) => [...prev, tag]);
								setSelectedTagIds((prev) => [...prev, tag.id]);
							}}
						/>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting} className="gap-1.5">
							{isSubmitting && <Spinner />}
							{isSubmitting ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
