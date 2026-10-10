"use client";

import { Spinner } from "@/components/Spinner";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import { createRecurringTransaction } from "@/features/kuroji/actions/recurring";
import { AccountSelect } from "@/features/kuroji/components/AccountSelect";
import { CURRENCIES, toCurrency } from "@/features/kuroji/lib/constants";
import { useFormOptions } from "@/features/kuroji/lib/form-options-store";
import { amountSchema, parseAmount } from "@/features/kuroji/lib/transaction-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
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
} from "@seikatsu/ui";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;

const formSchema = z.object({
	fromAccountId: z.string().min(1, "Pick an account"),
	toAccountId: z.string().min(1, "Pick an account"),
	amount: amountSchema,
	currency: z.enum(CURRENCIES),
	description: z.string().optional(),
	frequency: z.enum(FREQUENCIES),
	startDate: z.string().min(1, "Pick a start date"),
	endDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type Account = Awaited<ReturnType<typeof getAccounts>>[number];

export function AddRecurringModal({
	workspaceId,
	baseCurrency,
}: {
	workspaceId: string;
	baseCurrency: string;
}) {
	const [open, setOpen] = React.useState(false);
	const { accounts } = useFormOptions(workspaceId, open);

	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		// Every field starts defined, so a blank one gets its own message, not a type error.
		defaultValues: {
			fromAccountId: "",
			toAccountId: "",
			amount: undefined,
			currency: toCurrency(baseCurrency),
			description: "",
			frequency: "monthly",
			startDate: new Date().toISOString().slice(0, 10),
			endDate: "",
		},
	});

	const onOpenChange = (val: boolean) => {
		setOpen(val);
		if (!val) reset();
	};

	const onSubmit = async (values: FormValues) => {
		const result = await createRecurringTransaction({
			workspaceId,
			fromAccountId: values.fromAccountId,
			toAccountId: values.toAccountId,
			amount: values.amount,
			currency: values.currency,
			description: values.description || undefined,
			frequency: values.frequency,
			startDate: values.startDate,
			endDate: values.endDate || undefined,
		});

		if ("error" in result) {
			toast.error(result.error);
		} else {
			toast.success("Recurring transaction created.");
			// Through onOpenChange so the next one starts from a blank form.
			onOpenChange(false);
		}
	};

	const wallets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");
	const categories = accounts.filter((a) => a.type === "EXPENSE" || a.type === "INCOME");
	const errs = errors as Record<string, { message?: string }>;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button variant="outline">Add Recurring</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New Recurring Transaction</DialogTitle>
					<DialogDescription className="sr-only">
						Recorded automatically on each due date.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={handleSubmit(onSubmit, () => toast.error("Check form for errors"))}
					className="space-y-4"
				>
					<div className="space-y-2">
						<Label htmlFor="rec-from">From Account</Label>
						<AccountSelect
							id="rec-from"
							control={control as never}
							name="fromAccountId"
							accounts={[...wallets, ...categories]}
							placeholder="Select account"
							error={errs.fromAccountId?.message}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="rec-to">To Account</Label>
						<AccountSelect
							id="rec-to"
							control={control as never}
							name="toAccountId"
							accounts={[...wallets, ...categories]}
							placeholder="Select account"
							error={errs.toAccountId?.message}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="rec-amount">Amount</Label>
						<div className="flex gap-2">
							<Input
								id="rec-amount"
								type="text"
								inputMode="decimal"
								autoComplete="off"
								placeholder="0,00"
								className="flex-1"
								{...register("amount", { setValueAs: parseAmount })}
							/>
							<Controller
								control={control}
								name="currency"
								render={({ field }) => (
									<Select onValueChange={field.onChange} value={field.value}>
										<SelectTrigger className="w-[90px]" aria-label="Currency">
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
						<Label htmlFor="rec-description">Description (optional)</Label>
						<Input
							id="rec-description"
							placeholder="e.g. Monthly rent"
							{...register("description")}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="rec-frequency">Frequency</Label>
							<Controller
								control={control}
								name="frequency"
								render={({ field }) => (
									<Select onValueChange={field.onChange} value={field.value}>
										<SelectTrigger id="rec-frequency">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{FREQUENCIES.map((f) => (
												<SelectItem key={f} value={f}>
													{f.charAt(0).toUpperCase() + f.slice(1)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="rec-start">Start Date</Label>
							<Input id="rec-start" type="date" {...register("startDate")} />
							{errs.startDate && (
								<p className="text-destructive text-[0.8rem]">{errs.startDate.message}</p>
							)}
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="rec-end">End Date (optional)</Label>
						<Input id="rec-end" type="date" {...register("endDate")} />
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting} className="gap-1.5">
							{isSubmitting && <Spinner />}
							{isSubmitting ? "Creating…" : "Create"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
