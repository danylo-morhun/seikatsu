"use client";

import { Spinner } from "@/components/Spinner";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getTags } from "@/features/kuroji/actions/tags";
import type { Tag } from "@/features/kuroji/actions/tags";
import { createTransaction } from "@/features/kuroji/actions/transactions";
import { AccountSelect } from "@/features/kuroji/components/AccountSelect";
import { TagSelect } from "@/features/kuroji/components/TagSelect";
import { CURRENCIES, toCurrency } from "@/features/kuroji/lib/constants";
import { formatCurrency } from "@/features/kuroji/lib/format";
import {
	type AddTransactionFormValues,
	type SplitItem,
	type TxType,
	addTransactionFormSchema,
} from "@/features/kuroji/lib/transaction-schema";
import { useRefreshRouter } from "@/hooks/useRefreshRouter";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import { toast } from "sonner";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];
type SplitField = SplitItem & { id: string };

export function AddTransactionModal({
	workspaceId,
	baseCurrency,
	trigger,
}: {
	workspaceId: string;
	baseCurrency: string;
	trigger?: React.ReactNode;
}) {
	const [open, setOpen] = React.useState(false);
	const [accounts, setAccounts] = React.useState<Account[]>([]);
	const [workspaceTags, setWorkspaceTags] = React.useState<Tag[]>([]);
	const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
	const [accountsLoading, setAccountsLoading] = React.useState(false);
	const [txType, setTxType] = React.useState<TxType>("expense");
	const refresh = useRefreshRouter();

	const defaultCurrency = toCurrency(baseCurrency);
	const today = format(new Date(), "yyyy-MM-dd");
	const blankSplit: SplitItem = { categoryId: "", amount: undefined as unknown as number };

	const {
		register,
		handleSubmit,
		control,
		reset,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<AddTransactionFormValues>({
		resolver: zodResolver(addTransactionFormSchema),
		defaultValues: {
			txType: "expense",
			description: undefined,
			currency: defaultCurrency,
			date: today,
			walletId: "",
			splits: [{ ...blankSplit }],
		} as unknown as AddTransactionFormValues,
	});

	// useFieldArray needs control typed with splits — discriminated union makes this necessary
	const splitControl = control as unknown as Control<{ splits: SplitItem[] }>;
	const {
		fields: splitFields,
		append: appendSplit,
		remove: removeSplit,
	} = useFieldArray({
		control: splitControl,
		name: "splits",
	});
	const typedSplitFields = splitFields as unknown as SplitField[];

	const watchSplits = watch("splits" as never) as SplitItem[] | undefined;
	const watchCurrency = (watch("currency") as string | undefined) ?? defaultCurrency;
	const splitTotal = watchSplits?.reduce((s, r) => s + (Number(r?.amount) || 0), 0) ?? 0;

	React.useEffect(() => {
		if (open) {
			setAccountsLoading(true);
			Promise.all([getAccounts(workspaceId), getTags(workspaceId)]).then(([accts, tags]) => {
				setAccounts(accts);
				setWorkspaceTags(tags);
				setAccountsLoading(false);
			});
		}
	}, [open, workspaceId]);

	React.useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (open) return;
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
				return;
			if (e.key === "n" || e.key === "N") {
				e.preventDefault();
				setOpen(true);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open]);

	const resetToType = (type: TxType) => {
		const base = { description: undefined, currency: defaultCurrency, date: today };
		if (type === "expense") {
			reset({
				...base,
				txType: "expense",
				walletId: "",
				splits: [{ ...blankSplit }],
			} as unknown as AddTransactionFormValues);
		} else if (type === "income") {
			reset({
				...base,
				txType: "income",
				walletId: "",
				splits: [{ ...blankSplit }],
			} as unknown as AddTransactionFormValues);
		} else {
			reset({
				...base,
				txType: "transfer",
				fromWalletId: "",
				toWalletId: "",
				amount: undefined as unknown as number,
			} as unknown as AddTransactionFormValues);
		}
	};

	const onOpenChange = (val: boolean) => {
		setOpen(val);
		if (!val) {
			resetToType("expense");
			setTxType("expense");
			setSelectedTagIds([]);
		}
	};

	const handleTabChange = (val: string) => {
		const next = val as TxType;
		setTxType(next);
		resetToType(next);
	};

	const onSubmit = async (values: AddTransactionFormValues) => {
		let result: { error: string } | { success: true };

		if (values.txType === "expense") {
			result = await createTransaction({
				workspaceId,
				fromAccountId: values.walletId,
				toSplits: values.splits.map((s) => ({ accountId: s.categoryId, amount: s.amount })),
				currency: values.currency,
				description: values.description,
				date: values.date,
				tagIds: selectedTagIds,
			});
		} else if (values.txType === "income") {
			result = await createTransaction({
				workspaceId,
				toAccountId: values.walletId,
				fromSplits: values.splits.map((s) => ({ accountId: s.categoryId, amount: s.amount })),
				currency: values.currency,
				description: values.description,
				date: values.date,
				tagIds: selectedTagIds,
			});
		} else {
			result = await createTransaction({
				workspaceId,
				fromAccountId: values.fromWalletId,
				toAccountId: values.toWalletId,
				amount: values.amount,
				currency: values.currency,
				description: values.description,
				date: values.date,
				tagIds: selectedTagIds,
			});
		}

		if ("error" in result) {
			toast.error(result.error);
			return;
		}

		toast.success("Transaction recorded.");
		refresh();
		setOpen(false);
	};

	const wallets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");
	const expenseCategories = accounts.filter((a) => a.type === "EXPENSE");
	const incomeCategories = accounts.filter((a) => a.type === "INCOME");
	const errs = errors as Record<string, unknown>;
	const splitErrs = (errs.splits ?? []) as Record<
		number,
		{ categoryId?: { message?: string }; amount?: { message?: string } }
	>;

	const currencySelect = (
		<Controller
			control={control}
			name="currency"
			render={({ field }: { field: { onChange: (v: string) => void; value: string } }) => (
				<Select onValueChange={field.onChange} value={field.value ?? defaultCurrency}>
					<SelectTrigger className="h-7 w-[80px] text-xs">
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
	);

	const renderSplitRows = (categories: Account[]) => (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label>{typedSplitFields.length > 1 ? "Categories" : "Category"}</Label>
				<div className="flex items-center gap-2">
					{typedSplitFields.length > 1 && (
						<span className="text-xs text-muted-foreground tabular-nums">
							Total: {formatCurrency(splitTotal, watchCurrency)}
						</span>
					)}
					{currencySelect}
				</div>
			</div>

			{typedSplitFields.map((field, index) => (
				<div key={field.id} className="flex items-start gap-2">
					<div className="flex-1 min-w-0">
						<AccountSelect
							control={control as never}
							name={`splits.${index}.categoryId`}
							accounts={categories}
							placeholder="Select category"
							error={splitErrs[index]?.categoryId?.message}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Input
							type="number"
							step="0.01"
							placeholder="0.00"
							className="w-24 shrink-0"
							{...(register as (name: string, opts?: object) => object)(`splits.${index}.amount`, {
								valueAsNumber: true,
							})}
						/>
						{splitErrs[index]?.amount?.message && (
							<p className="text-destructive text-[0.8rem]">{splitErrs[index].amount?.message}</p>
						)}
					</div>
					{typedSplitFields.length > 1 && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
							onClick={() => removeSplit(index)}
						>
							<HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
						</Button>
					)}
				</div>
			))}

			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-7 w-full text-xs text-muted-foreground hover:text-foreground"
				onClick={() => (appendSplit as (v: SplitItem) => void)({ ...blankSplit })}
			>
				+ Add split
			</Button>
		</div>
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button size="icon" className="h-8 w-8 md:w-auto md:px-3 md:gap-2">
						<HugeiconsIcon icon={Add01Icon} className="h-4 w-4 shrink-0" />
						<span className="hidden md:inline">New Transaction</span>
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center justify-between">
						New Transaction
						<kbd className="hidden md:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">N</kbd>
					</DialogTitle>
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
								<Label>Account</Label>
								<AccountSelect
									control={control as never}
									name="walletId"
									accounts={wallets}
									placeholder="Select account"
									error={(errs.walletId as { message?: string })?.message}
								/>
							</div>
							{renderSplitRows(expenseCategories)}
						</TabsContent>

						<TabsContent value="income" className="space-y-4">
							<div className="space-y-2">
								<Label>Account</Label>
								<AccountSelect
									control={control as never}
									name="walletId"
									accounts={wallets}
									placeholder="Select account"
									error={(errs.walletId as { message?: string })?.message}
								/>
							</div>
							{renderSplitRows(incomeCategories)}
						</TabsContent>

						<TabsContent value="transfer" className="space-y-4">
							<div className="space-y-2">
								<Label>From Account</Label>
								<AccountSelect
									control={control as never}
									name="fromWalletId"
									accounts={wallets}
									placeholder="Select source wallet"
									error={(errs.fromWalletId as { message?: string })?.message}
								/>
							</div>
							<div className="space-y-2">
								<Label>To Account</Label>
								<AccountSelect
									control={control as never}
									name="toWalletId"
									accounts={wallets}
									placeholder="Select destination wallet"
									error={(errs.toWalletId as { message?: string })?.message}
								/>
							</div>
							<div className="space-y-2">
								<Label>Amount</Label>
								<div className="flex gap-2">
									<Input
										type="number"
										step="0.01"
										placeholder="0.00"
										className="flex-1"
										{...(register as (name: string, opts?: object) => object)("amount", {
											valueAsNumber: true,
										})}
									/>
									<Controller
										control={control as never}
										name="currency"
										render={({
											field,
										}: { field: { onChange: (v: string) => void; value: string } }) => (
											<Select onValueChange={field.onChange} value={field.value ?? defaultCurrency}>
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
								{(errs.amount as { message?: string })?.message && (
									<p className="text-destructive text-[0.8rem]">
										{(errs.amount as { message?: string }).message}
									</p>
								)}
							</div>
						</TabsContent>
					</Tabs>

					<div className="space-y-2">
						<Label htmlFor="add-description">Description</Label>
						<Input
							id="add-description"
							placeholder="e.g. Grocery run"
							{...register("description")}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="add-date">Date</Label>
						<Input id="add-date" type="date" {...register("date")} />
						{(errs.date as { message?: string })?.message && (
							<p className="text-destructive text-[0.8rem]">
								{(errs.date as { message?: string }).message}
							</p>
						)}
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
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
