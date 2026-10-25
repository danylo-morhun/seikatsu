"use client";

import { AutoHeight } from "@/components/AutoHeight";
import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import type { ServiceWithItems } from "@/features/aisha/actions/data";
import { logService, updateService } from "@/features/aisha/actions/services";
import { FOOTER, FieldError, instantClass } from "@/features/aisha/components/DialogParts";
import { CURRENCY } from "@/features/aisha/lib/constants";
import { parseNumber } from "@/features/aisha/lib/format";
import { localToday } from "@/features/aisha/lib/today";
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

export type KurojiDefaults = { walletId: string | null; categoryId: string | null };

type Form = {
	date: string;
	km: string;
	itemIds: string[];
	cost: string;
	shop: string;
	note: string;
	kuroji: boolean;
	walletId: string;
	categoryId: string;
};

function formOf(
	service: ServiceWithItems | null,
	preselected: string[],
	currentKm: number,
	defaults: KurojiDefaults,
): Form {
	return {
		date: service?.date ?? localToday(),
		km: String(service?.km ?? currentKm),
		itemIds: service ? service.items.map((i) => i.id) : preselected,
		cost: service?.cost != null ? String(Number(service.cost)).replace(".", ",") : "",
		shop: service?.shop ?? "",
		note: service?.note ?? "",
		// Recorded last time: offer it again.
		kuroji: !service && defaults.walletId != null && defaults.categoryId != null,
		walletId: defaults.walletId ?? "",
		categoryId: defaults.categoryId ?? "",
	};
}

/**
 * One garage visit: what was done, when, at what mileage, and what it cost. A new one, or an
 * existing one with every field editable. The cost can go to Kuroji as an expense.
 */
export function ServiceDialog({
	open,
	onOpenChange,
	instant,
	vehicleId,
	workspaceId,
	currentKm,
	items,
	kurojiDefaults,
	service = null,
	preselected = [],
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	instant?: boolean;
	vehicleId: string;
	workspaceId: string;
	currentKm: number;
	items: { id: string; name: string }[];
	kurojiDefaults: KurojiDefaults;
	/** null = log a new visit. */
	service?: ServiceWithItems | null;
	preselected?: string[];
}) {
	const id = useId();
	const [form, setForm] = useState(() => formOf(service, preselected, currentKm, kurojiDefaults));
	const [error, setError] = useState<{ field?: keyof Form; message: string } | null>(null);
	const [isSaving, startSave] = useTransition();
	const linked = service?.kurojiTransactionId != null;
	const { accounts, loading } = useFormOptions(workspaceId, open && form.kuroji && !linked);
	const wallets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");
	const categories = accounts.filter((a) => a.type === "EXPENSE");

	const set = <K extends keyof Form>(key: K, value: Form[K]) => {
		setForm((f) => ({ ...f, [key]: value }));
		setError(null);
	};

	useEffect(() => {
		if (open) {
			setForm(formOf(service, preselected, currentKm, kurojiDefaults));
			setError(null);
		}
		// Each opening starts from what was asked for, not from the last edit.
	}, [open]);

	function toggleItem(itemId: string) {
		set(
			"itemIds",
			form.itemIds.includes(itemId)
				? form.itemIds.filter((x) => x !== itemId)
				: [...form.itemIds, itemId],
		);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const km = parseNumber(form.km);
		if (km == null || !Number.isInteger(km)) {
			setError({ field: "km", message: "Enter the mileage in whole km" });
			document.getElementById(`${id}-km`)?.focus();
			return;
		}
		if (form.itemIds.length === 0) {
			setError({ field: "itemIds", message: "Pick what was done" });
			return;
		}
		const cost = parseNumber(form.cost);
		if (form.cost.trim() && cost == null) {
			setError({ field: "cost", message: "Enter the cost as a number" });
			return;
		}
		const toKuroji = form.kuroji && !linked && cost != null && cost > 0;
		if (toKuroji && (!form.walletId || !form.categoryId)) {
			setError({ field: "kuroji", message: "Pick the wallet and the expense category" });
			return;
		}
		const values = {
			date: form.date,
			km,
			itemIds: form.itemIds,
			cost,
			shop: form.shop,
			note: form.note,
			kuroji: toKuroji ? { walletId: form.walletId, categoryId: form.categoryId } : null,
		};
		startSave(async () => {
			const result = await (service
				? updateService(service.id, values)
				: logService(vehicleId, values)
			).catch(() => ({ error: "Couldn't save. Check your connection." }));
			if ("error" in result) {
				setError({ message: result.error });
				return;
			}
			if (result.warning) toast.warning(result.warning);
			else if (!service)
				toast.success(toKuroji ? "Service logged, and in Kuroji" : "Service logged");
			onOpenChange(false);
		});
	}

	const invalid = (field: keyof Form) => error?.field === field || undefined;

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className={cn("sm:max-w-lg max-sm:flex max-sm:flex-col", instantClass(instant))}
				onOpenAutoFocus={(e) => {
					// The phone's keyboard stays down: the date and km are usually right already.
					e.preventDefault();
				}}
			>
				<DialogHeader>
					<DialogTitle>{service ? "Edit Service" : "Log Service"}</DialogTitle>
					<DialogDescription className="sr-only">
						What was done at the garage, when, at what mileage, and what it cost.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="grid grid-cols-2 gap-3">
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
						<div className="space-y-2">
							<Label htmlFor={`${id}-km`}>Mileage, km</Label>
							<Input
								id={`${id}-km`}
								inputMode="numeric"
								autoComplete="off"
								className="font-figures"
								value={form.km}
								aria-invalid={invalid("km")}
								onChange={(e) => set("km", e.target.value)}
							/>
						</div>
					</div>

					<fieldset className="space-y-2">
						<legend className="mb-2 text-sm font-medium leading-none">What was done</legend>
						<div className="flex flex-wrap gap-1.5">
							{items.map((item) => {
								const on = form.itemIds.includes(item.id);
								return (
									<button
										key={item.id}
										type="button"
										aria-pressed={on}
										onClick={() => toggleItem(item.id)}
										className={cn(
											"h-9 rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring max-sm:h-10",
											on
												? "bg-primary text-primary-foreground"
												: "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground",
										)}
									>
										{item.name}
									</button>
								);
							})}
						</div>
						{error?.field === "itemIds" && <FieldError>{error.message}</FieldError>}
					</fieldset>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor={`${id}-cost`}>Cost, {CURRENCY}</Label>
							<Input
								id={`${id}-cost`}
								inputMode="decimal"
								autoComplete="off"
								placeholder="Optional"
								className="font-figures"
								value={form.cost}
								aria-invalid={invalid("cost")}
								onChange={(e) => set("cost", e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${id}-shop`}>Garage</Label>
							<Input
								id={`${id}-shop`}
								autoComplete="off"
								placeholder="Optional"
								value={form.shop}
								onChange={(e) => set("shop", e.target.value)}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${id}-note`}>Note</Label>
						<Input
							id={`${id}-note`}
							autoComplete="off"
							placeholder="Oil 5W-30; pads at 40%"
							value={form.note}
							onChange={(e) => set("note", e.target.value)}
						/>
					</div>

					{linked ? (
						<p className="text-xs text-muted-foreground">
							In Kuroji as an expense: its amount, date and description follow these changes.
						</p>
					) : (
						<AutoHeight>
							{form.kuroji ? (
								<div className="animate-swap space-y-2">
									<div className="flex items-baseline justify-between gap-3">
										<span className="text-sm font-medium">Record in Kuroji</span>
										<button
											type="button"
											className="text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded"
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
									{!form.cost.trim() && (
										<p className="text-xs text-muted-foreground">
											Enter the cost to record it as an expense.
										</p>
									)}
								</div>
							) : (
								<QuietAdd onClick={() => set("kuroji", true)}>Record in Kuroji</QuietAdd>
							)}
						</AutoHeight>
					)}

					{error && error.field !== "itemIds" && <FieldError>{error.message}</FieldError>}
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
							{isSaving ? "Saving…" : service ? "Save" : "Log Service"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
