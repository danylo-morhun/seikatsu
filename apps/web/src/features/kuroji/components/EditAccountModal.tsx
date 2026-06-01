"use client";

import { Spinner } from "@/components/Spinner";
import { getAccounts, updateAccount } from "@/features/kuroji/actions/accounts";
import { CURRENCIES, toCurrency } from "@/features/kuroji/lib/constants";
import { useRefreshRouter } from "@/hooks/useRefreshRouter";
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
} from "@seikatsu/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "INCOME", "EXPENSE"] as const;

const formSchema = z.object({
	name: z.string().min(1, "Name required"),
	type: z.enum(ACCOUNT_TYPES, { error: "Select a type" }),
	currency: z.enum(CURRENCIES),
	parentId: z.string().optional(),
	budget: z.number().positive().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type Account = Awaited<ReturnType<typeof getAccounts>>[number];

interface Props {
	account: Account;
	workspaceId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function EditAccountModal({ account, workspaceId, open, onOpenChange }: Props) {
	const [accounts, setAccounts] = React.useState<Account[]>([]);
	const refresh = useRefreshRouter();

	const {
		register,
		handleSubmit,
		control,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: account.name,
			type: account.type,
			currency: toCurrency(account.currency),
			parentId: account.parentId ?? undefined,
			budget: account.budget != null ? Number(account.budget) : undefined,
		},
	});

	const selectedType = watch("type");

	React.useEffect(() => {
		if (open) {
			getAccounts(workspaceId).then(setAccounts);
			reset({
				name: account.name,
				type: account.type,
				currency: toCurrency(account.currency),
				parentId: account.parentId ?? undefined,
				budget: account.budget != null ? Number(account.budget) : undefined,
			});
		}
	}, [open, workspaceId, account, reset]);

	const onSubmit = async (values: FormValues) => {
		try {
			await updateAccount(account.id, {
				name: values.name,
				type: values.type,
				currency: values.currency,
				parentId: values.parentId || null,
				budget:
					values.type === "EXPENSE" || values.type === "INCOME" ? (values.budget ?? null) : null,
			});
			toast.success("Account updated");
			refresh();
			onOpenChange(false);
		} catch {
			toast.error("Failed to update account");
		}
	};

	const parentOptions = accounts.filter((a) => a.id !== account.id);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Account</DialogTitle>
				</DialogHeader>

				<form
					onSubmit={handleSubmit(onSubmit, () => toast.error("Please check the form for errors"))}
					className="space-y-4"
				>
					<div className="space-y-2">
						<Label htmlFor="edit-acc-name">Name</Label>
						<Input id="edit-acc-name" {...register("name")} />
						{errors.name && <p className="text-destructive text-[0.8rem]">{errors.name.message}</p>}
					</div>

					<div className="space-y-2">
						<Label>Type</Label>
						<Controller
							control={control}
							name="type"
							render={({ field }) => (
								<Select onValueChange={field.onChange} value={field.value}>
									<SelectTrigger>
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										{ACCOUNT_TYPES.map((t) => (
											<SelectItem key={t} value={t}>
												{t.charAt(0) + t.slice(1).toLowerCase()}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
						{errors.type && <p className="text-destructive text-[0.8rem]">{errors.type.message}</p>}
					</div>

					<div className="space-y-2">
						<Label>Currency</Label>
						<Controller
							control={control}
							name="currency"
							render={({ field }) => (
								<Select onValueChange={field.onChange} value={field.value}>
									<SelectTrigger>
										<SelectValue placeholder="Select currency" />
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

					{(selectedType === "EXPENSE" || selectedType === "INCOME") && (
						<div className="space-y-2">
							<Label htmlFor="edit-acc-budget">
								{selectedType === "INCOME"
									? "Monthly Target (Optional)"
									: "Monthly Budget (Optional)"}
							</Label>
							<Input
								id="edit-acc-budget"
								type="number"
								min="0"
								step="0.01"
								placeholder="e.g. 500"
								{...register("budget", {
									setValueAs: (v) => (v === "" || v === undefined ? undefined : Number(v)),
								})}
							/>
							{errors.budget && (
								<p className="text-destructive text-[0.8rem]">{errors.budget.message}</p>
							)}
						</div>
					)}

					<div className="space-y-2">
						<Label>Parent Account (optional)</Label>
						<Controller
							control={control}
							name="parentId"
							render={({ field }) => (
								<Select onValueChange={field.onChange} value={field.value ?? ""}>
									<SelectTrigger>
										<SelectValue placeholder="None" />
									</SelectTrigger>
									<SelectContent>
										{parentOptions.map((a) => (
											<SelectItem key={a.id} value={a.id}>
												{a.name} ({a.type})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
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
