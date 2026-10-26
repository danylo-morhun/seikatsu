"use client";

import { AutoHeight } from "@/components/AutoHeight";
import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import { FOOTER, FieldError, instantClass } from "@/features/aisha/components/DialogParts";
import { parseNumber } from "@/features/aisha/lib/format";
import { localToday } from "@/features/aisha/lib/today";
import type { ChromeData, HoshiiItem } from "@/features/hoshii/actions/data";
import { buyItem } from "@/features/hoshii/actions/items";
import { CurrencySelect } from "@/features/hoshii/components/Parts";
import { AccountPicker } from "@/features/kuroji/components/AccountSelect";
import { useFormOptions } from "@/features/kuroji/lib/form-options-store";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	cn,
} from "@seikatsu/ui";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

type Form = {
	paid: string;
	currency: string;
	date: string;
	kuroji: boolean;
	walletId: string;
	categoryId: string;
};

function formOf(item: HoshiiItem | null, chrome: ChromeData): Form {
	const bought = item?.state === "bought";
	const amount = bought ? item.boughtPrice : item?.price;
	return {
		paid: amount != null ? String(Number(amount)).replace(".", ",") : "",
		currency: (bought ? item.boughtCurrency : item?.currency) ?? chrome.currency,
		date: (bought ? item.boughtOn : null) ?? localToday(),
		// Set up once (a purchase recorded before, or the piggy chosen): offer it again.
		kuroji: !bought && chrome.kuroji.walletId != null && chrome.kuroji.categoryId != null,
		walletId: chrome.kuroji.walletId ?? "",
		categoryId: chrome.kuroji.categoryId ?? "",
	};
}

/** Bought it: what was paid and when, and the expense in Kuroji. Also edits a purchase. */
export function BuyDialog({
	open,
	onOpenChange,
	instant,
	chrome,
	item,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	instant?: boolean;
	chrome: ChromeData;
	item: HoshiiItem | null;
}) {
	const id = useId();
	const [form, setForm] = useState(() => formOf(item, chrome));
	const [error, setError] = useState<{ field?: keyof Form; message: string } | null>(null);
	const [isSaving, startSave] = useTransition();
	const editing = item?.state === "bought";
	const linked = item?.kurojiTransactionId != null;
	const { accounts, loading } = useFormOptions(chrome.workspaceId, open && form.kuroji && !linked);
	const wallets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");
	const categories = accounts.filter((a) => a.type === "EXPENSE");

	useEffect(() => {
		if (open) {
			setForm(formOf(item, chrome));
			setError(null);
		}
		// Each opening starts from the want, not from the last edit.
	}, [open]);

	const set = <K extends keyof Form>(key: K, value: Form[K]) => {
		setForm((f) => ({ ...f, [key]: value }));
		setError(null);
	};

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!item) return;
		const paid = parseNumber(form.paid);
		if (paid == null || paid < 0) {
			setError({ field: "paid", message: "Enter what you paid" });
			document.getElementById(`${id}-paid`)?.focus();
			return;
		}
		const toKuroji = form.kuroji && !linked && paid > 0;
		if (toKuroji && (!form.walletId || !form.categoryId)) {
			setError({ field: "kuroji", message: "Pick the account and the expense category" });
			return;
		}
		startSave(async () => {
			const result = await buyItem(item.id, {
				paid,
				currency: form.currency,
				date: form.date,
				kuroji: toKuroji ? { walletId: form.walletId, categoryId: form.categoryId } : null,
			}).catch(() => ({ error: "Couldn't save. Check your connection." }));
			if ("error" in result) {
				setError({ message: result.error });
				return;
			}
			if (result.warning) toast.warning(result.warning);
			else if (!editing) toast.success(toKuroji ? "Bought, and in Kuroji" : "Bought");
			onOpenChange(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className={cn("sm:max-w-md max-sm:flex max-sm:flex-col", instantClass(instant))}
			>
				<DialogHeader>
					<DialogTitle>{editing ? "Edit Purchase" : "Bought It"}</DialogTitle>
					<DialogDescription className="truncate">{item?.title}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
						<div className="space-y-2">
							<Label htmlFor={`${id}-paid`}>Paid</Label>
							<Input
								id={`${id}-paid`}
								inputMode="decimal"
								autoComplete="off"
								className="font-figures"
								value={form.paid}
								aria-invalid={error?.field === "paid" || undefined}
								onChange={(e) => set("paid", e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${id}-currency`}>Currency</Label>
							<CurrencySelect
								id={`${id}-currency`}
								value={form.currency}
								onChange={(v) => set("currency", v)}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${id}-date`}>Date</Label>
						<Input
							id={`${id}-date`}
							type="date"
							required
							max={localToday()}
							value={form.date}
							onChange={(e) => set("date", e.target.value)}
						/>
					</div>

					{linked ? (
						<p className="text-xs text-muted-foreground">
							In Kuroji as an expense: its amount, currency and date follow these changes.
						</p>
					) : (
						<AutoHeight>
							{form.kuroji ? (
								<div className="animate-swap space-y-2">
									<div className="flex items-baseline justify-between gap-3">
										<span className="text-sm font-medium">Record in Kuroji</span>
										<button
											type="button"
											className="rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
											onClick={() => set("kuroji", false)}
										>
											Don't record
										</button>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<AccountPicker
											aria-label="Paid from"
											placeholder={loading ? "Loading…" : "Paid from"}
											accounts={wallets}
											value={form.walletId}
											invalid={error?.field === "kuroji" && !form.walletId}
											onValueChange={(v) => set("walletId", v)}
										/>
										<AccountPicker
											aria-label="Expense category"
											placeholder={loading ? "Loading…" : "Category"}
											accounts={categories}
											value={form.categoryId}
											invalid={error?.field === "kuroji" && !form.categoryId}
											onValueChange={(v) => set("categoryId", v)}
										/>
									</div>
								</div>
							) : (
								<QuietAdd onClick={() => set("kuroji", true)}>Record in Kuroji</QuietAdd>
							)}
						</AutoHeight>
					)}

					{error && <FieldError>{error.message}</FieldError>}
					<div className={FOOTER}>
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							disabled={isSaving}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" className="gap-1.5 max-sm:flex-1" disabled={isSaving}>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : editing ? "Save" : "Bought"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
