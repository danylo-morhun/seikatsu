"use client";

import { Spinner } from "@/components/Spinner";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import { createTransaction } from "@/features/kuroji/actions/transactions";
import { AccountSelect } from "@/features/kuroji/components/AccountSelect";
import { TagSelect } from "@/features/kuroji/components/TagSelect";
import { CURRENCIES, toCurrency } from "@/features/kuroji/lib/constants";
import { addTagToFormOptions, useFormOptions } from "@/features/kuroji/lib/form-options-store";
import { formatCurrency } from "@/features/kuroji/lib/format";
import {
	type AddTransactionFormValues,
	DESCRIPTION_PLACEHOLDER,
	type SplitItem,
	type TxType,
	addTransactionFormSchema,
	parseAmount,
} from "@/features/kuroji/lib/transaction-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
	TabsList,
	TabsTrigger,
	cn,
} from "@seikatsu/ui";
import { format } from "date-fns";
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
	shortcut = false,
}: {
	workspaceId: string;
	baseCurrency: string;
	trigger?: React.ReactNode;
	/** Own the global "N" shortcut. Exactly one mounted instance should, or N opens several. */
	shortcut?: boolean;
}) {
	const [open, setOpen] = React.useState(false);
	const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
	const [txType, setTxType] = React.useState<TxType>("expense");
	// Text as typed ("12,50"); the form holds the parsed number.
	const [amountText, setAmountText] = React.useState("");
	const [tagsOpen, setTagsOpen] = React.useState(false);

	const defaultCurrency = toCurrency(baseCurrency);
	const today = format(new Date(), "yyyy-MM-dd");
	const blankSplit: SplitItem = { categoryId: "", amount: undefined as unknown as number };

	const {
		register,
		handleSubmit,
		control,
		reset,
		watch,
		setValue,
		setFocus,
		getValues,
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

	const { accounts, tags: workspaceTags } = useFormOptions(workspaceId, open);

	// Default the amount's currency to the paying account's, so entries land in its currency.
	const watchWalletId = watch("walletId" as never) as unknown as string | undefined;
	const watchFromId = watch("fromWalletId" as never) as unknown as string | undefined;
	const watchToId = watch("toWalletId" as never) as unknown as string | undefined;
	const currencyOf = (id: string | undefined) => accounts.find((a) => a.id === id)?.currency;
	const sourceCurrency = currencyOf(txType === "transfer" ? watchFromId : watchWalletId);
	React.useEffect(() => {
		if (sourceCurrency) setValue("currency", toCurrency(sourceCurrency));
	}, [sourceCurrency, setValue]);
	const toCurrencyCode = currencyOf(watchToId);
	const showReceived =
		txType === "transfer" && !!toCurrencyCode && toCurrencyCode !== watchCurrency;

	React.useEffect(() => {
		if (!shortcut) return;
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
	}, [open, shortcut]);

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
			setAmountText("");
			setTagsOpen(false);
		}
	};

	const amountField = (type: TxType) => (type === "transfer" ? "amount" : "splits.0.amount");

	const handleTabChange = (val: string) => {
		const next = val as TxType;
		setTxType(next);
		resetToType(next);
		// Picking the type after typing the amount is common: keep the amount, reset the rest.
		if (amountText) setValue(amountField(next) as never, parseAmount(amountText) as never);
		requestAnimationFrame(() => setFocus(amountField(next) as never));
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
				received: showReceived ? values.received : undefined,
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

	const registerAny = register as (name: string, opts?: object) => object;
	const amountInputProps = {
		type: "text",
		inputMode: "decimal" as const,
		autoComplete: "off",
		placeholder: "0,00",
	};
	const isSplit = txType !== "transfer" && typedSplitFields.length > 1;
	// Back to one category: the amount field takes over whatever the remaining row holds.
	React.useEffect(() => {
		if (isSplit) return;
		const value = getValues("splits.0.amount" as never) as unknown as number | undefined;
		setAmountText(value === undefined || Number.isNaN(value) ? "" : String(value));
	}, [isSplit, getValues]);
	const amountError = (txType === "transfer" ? errs.amount : (splitErrs[0]?.amount as unknown)) as
		| { message?: string }
		| undefined;

	const currencySelect = (
		<Controller
			control={control}
			name="currency"
			render={({ field }: { field: { onChange: (v: string) => void; value: string } }) => (
				<Select onValueChange={field.onChange} value={field.value ?? defaultCurrency}>
					<SelectTrigger className="w-24 shrink-0" aria-label="Currency">
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

	// One amount field up front; with splits it becomes the read-only total of the rows below.
	const amountHero = (
		<div className="space-y-2">
			<Label htmlFor={isSplit ? undefined : "add-amount"}>{isSplit ? "Total" : "Amount"}</Label>
			<div className="flex gap-2">
				{isSplit ? (
					<p className="flex h-10 flex-1 items-center rounded-md border border-input bg-surface px-3 font-figures text-lg font-semibold">
						{formatCurrency(splitTotal, watchCurrency)}
					</p>
				) : (
					<Controller
						key={amountField(txType)}
						control={control as never}
						name={amountField(txType) as never}
						render={({
							field,
						}: { field: { onChange: (v: unknown) => void; ref: React.Ref<HTMLInputElement> } }) => (
							<Input
								id="add-amount"
								{...amountInputProps}
								ref={field.ref}
								value={amountText}
								onChange={(e) => {
									setAmountText(e.target.value);
									field.onChange(parseAmount(e.target.value));
								}}
								className="flex-1 font-figures text-lg font-semibold md:text-lg"
							/>
						)}
					/>
				)}
				{currencySelect}
			</div>
			{!isSplit && amountError?.message && (
				<p className="text-destructive text-[0.8rem]">{amountError.message}</p>
			)}
		</div>
	);

	const renderSplitRows = (categories: Account[]) => (
		<div className="space-y-2">
			<Label>{isSplit ? "Categories" : "Category"}</Label>

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
					{isSplit && (
						<div className="flex flex-col gap-1">
							<Input
								{...amountInputProps}
								aria-label={`Amount for category ${index + 1}`}
								className="w-28 shrink-0 tabular-nums"
								{...registerAny(`splits.${index}.amount`, { setValueAs: parseAmount })}
							/>
							{splitErrs[index]?.amount?.message && (
								<p className="text-destructive text-[0.8rem]">{splitErrs[index].amount?.message}</p>
							)}
						</div>
					)}
					{isSplit && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
							aria-label={`Remove category ${index + 1}`}
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
				className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
				onClick={() => (appendSplit as (v: SplitItem) => void)({ ...blankSplit })}
			>
				{isSplit ? "+ Add category" : "+ Split across categories"}
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
			<DialogContent
				className="sm:max-w-lg max-sm:flex max-sm:flex-col"
				aria-describedby={undefined}
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					setFocus(amountField(txType) as never);
				}}
			>
				<DialogHeader>
					<DialogTitle>New Transaction</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4">
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
					</Tabs>

					{amountHero}

					{txType === "expense" && (
						<div className={cn("grid gap-4", !isSplit && "sm:grid-cols-2")}>
							{renderSplitRows(expenseCategories)}
							<div className="space-y-2">
								<Label>Paid from</Label>
								<AccountSelect
									control={control as never}
									name="walletId"
									accounts={wallets}
									placeholder="Select account"
									error={(errs.walletId as { message?: string })?.message}
								/>
							</div>
						</div>
					)}

					{txType === "income" && (
						<div className={cn("grid gap-4", !isSplit && "sm:grid-cols-2")}>
							{renderSplitRows(incomeCategories)}
							<div className="space-y-2">
								<Label>Received in</Label>
								<AccountSelect
									control={control as never}
									name="walletId"
									accounts={wallets}
									placeholder="Select account"
									error={(errs.walletId as { message?: string })?.message}
								/>
							</div>
						</div>
					)}

					{txType === "transfer" && (
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label>From</Label>
								<AccountSelect
									control={control as never}
									name="fromWalletId"
									accounts={wallets}
									placeholder="Select source account"
									error={(errs.fromWalletId as { message?: string })?.message}
								/>
							</div>
							<div className="space-y-2">
								<Label>To</Label>
								<AccountSelect
									control={control as never}
									name="toWalletId"
									accounts={wallets}
									placeholder="Select destination account"
									error={(errs.toWalletId as { message?: string })?.message}
								/>
							</div>
							{showReceived && (
								<div className="space-y-2 sm:col-span-2">
									<Label htmlFor="add-received">Received ({toCurrencyCode})</Label>
									<Input
										id="add-received"
										{...amountInputProps}
										placeholder="Blank = convert at the day's rate"
										{...registerAny("received", { setValueAs: parseAmount })}
									/>
									{(errs.received as { message?: string })?.message && (
										<p className="text-destructive text-[0.8rem]">
											{(errs.received as { message?: string }).message}
										</p>
									)}
								</div>
							)}
						</div>
					)}

					<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
						<div className="space-y-2">
							<Label htmlFor="add-description">Description</Label>
							<Input
								id="add-description"
								placeholder={DESCRIPTION_PLACEHOLDER[txType]}
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
					</div>

					{/* Tags are occasional: one quiet line until asked for. */}
					{tagsOpen || selectedTagIds.length > 0 ? (
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
									addTagToFormOptions(workspaceId, tag);
									setSelectedTagIds((prev) => [...prev, tag.id]);
								}}
							/>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setTagsOpen(true)}
							className="self-start text-sm text-muted-foreground hover:text-foreground"
						>
							+ Add tags
						</button>
					)}

					{/* Phones: actions sit at the bottom of the full-screen sheet, in thumb reach. */}
					<div className="mt-auto flex justify-end gap-2 pt-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-background max-sm:px-6 max-sm:py-4">
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting} className="gap-1.5 max-sm:flex-1">
							{isSubmitting && <Spinner />}
							{isSubmitting ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
