"use client";

import { getAccounts } from "@/features/kuroji/actions/accounts";
import { createRecurringTransaction } from "@/features/kuroji/actions/recurring";
import { AccountSelect } from "@/features/kuroji/components/AccountSelect";
import { CURRENCIES, toCurrency } from "@/features/kuroji/lib/constants";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;

const formSchema = z.object({
	fromAccountId: z.string().min(1, "Required"),
	toAccountId: z.string().min(1, "Required"),
	amount: z.number().positive("Must be positive"),
	currency: z.enum(CURRENCIES),
	description: z.string().optional(),
	frequency: z.enum(FREQUENCIES),
	startDate: z.string().min(1, "Required"),
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
	const [accounts, setAccounts] = React.useState<Account[]>([]);
	const router = useRouter();

	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			currency: toCurrency(baseCurrency),
			frequency: "monthly",
			startDate: new Date().toISOString().slice(0, 10),
		} as Partial<FormValues>,
	});

	React.useEffect(() => {
		if (open) getAccounts(workspaceId).then(setAccounts);
	}, [open, workspaceId]);

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
			router.refresh();
			setOpen(false);
		}
	};

	const wallets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");
	const categories = accounts.filter((a) => a.type === "EXPENSE" || a.type === "INCOME");
	const errs = errors as Record<string, { message?: string }>;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					Add Recurring
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New Recurring Transaction</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={handleSubmit(onSubmit, () => toast.error("Check form for errors"))}
					className="space-y-4"
				>
					<div className="space-y-2">
						<Label>From Account</Label>
						<AccountSelect
							control={control as never}
							name="fromAccountId"
							accounts={[...wallets, ...categories]}
							placeholder="Select account"
							error={errs.fromAccountId?.message}
						/>
					</div>
					<div className="space-y-2">
						<Label>To Account</Label>
						<AccountSelect
							control={control as never}
							name="toAccountId"
							accounts={[...wallets, ...categories]}
							placeholder="Select account"
							error={errs.toAccountId?.message}
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
								{...register("amount", { valueAsNumber: true })}
							/>
							<Controller
								control={control}
								name="currency"
								render={({ field }) => (
									<Select onValueChange={field.onChange} value={field.value}>
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
						<Label>Description (optional)</Label>
						<Input placeholder="e.g. Monthly rent" {...register("description")} />
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label>Frequency</Label>
							<Controller
								control={control}
								name="frequency"
								render={({ field }) => (
									<Select onValueChange={field.onChange} value={field.value}>
										<SelectTrigger>
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
							<Label>Start Date</Label>
							<Input type="date" {...register("startDate")} />
							{errs.startDate && (
								<p className="text-destructive text-[0.8rem]">{errs.startDate.message}</p>
							)}
						</div>
					</div>
					<div className="space-y-2">
						<Label>End Date (optional)</Label>
						<Input type="date" {...register("endDate")} />
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Creating…" : "Create"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
