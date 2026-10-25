"use client";

import { AutoHeight } from "@/components/AutoHeight";
import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import type { AishaItem } from "@/features/aisha/actions/data";
import { createItem, updateItem } from "@/features/aisha/actions/items";
import { FOOTER, FieldError, instantClass } from "@/features/aisha/components/DialogParts";
import { parseNumber } from "@/features/aisha/lib/format";
import { localToday } from "@/features/aisha/lib/today";
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

type Form = {
	name: string;
	intervalKm: string;
	intervalMonths: string;
	note: string;
	baseline: boolean;
	baselineDate: string;
	baselineKm: string;
};

function formOf(item: AishaItem | null): Form {
	return {
		name: item?.name ?? "",
		intervalKm: item?.intervalKm?.toString() ?? "",
		intervalMonths: item?.intervalMonths?.toString() ?? "",
		note: item?.note ?? "",
		baseline: item?.baselineDate != null,
		baselineDate: item?.baselineDate ?? localToday(),
		baselineKm: item?.baselineKm?.toString() ?? "",
	};
}

const whole = (text: string) => {
	const n = parseNumber(text);
	return n != null && Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * A maintenance item: what, how often (km, months, or both — whichever comes first), and,
 * when no service shows it, when it was last done before Aisha.
 */
export function ItemDialog({
	open,
	onOpenChange,
	instant,
	vehicleId,
	item = null,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	instant?: boolean;
	vehicleId: string;
	/** null = a new item. */
	item?: AishaItem | null;
}) {
	const id = useId();
	const [form, setForm] = useState(() => formOf(item));
	const [error, setError] = useState<{ field?: keyof Form; message: string } | null>(null);
	const [isSaving, startSave] = useTransition();
	const set = <K extends keyof Form>(key: K, value: Form[K]) => {
		setForm((f) => ({ ...f, [key]: value }));
		setError(null);
	};

	useEffect(() => {
		if (open) {
			setForm(formOf(item));
			setError(null);
		}
		// Each opening starts from the saved item; a re-render while open keeps the edits.
	}, [open]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.name.trim()) {
			setError({ field: "name", message: "Name the item" });
			document.getElementById(`${id}-name`)?.focus();
			return;
		}
		const intervalKm = whole(form.intervalKm);
		const intervalMonths = whole(form.intervalMonths);
		if (intervalKm == null && intervalMonths == null) {
			setError({ field: "intervalKm", message: "Set how often: km, months, or both" });
			return;
		}
		const baselineKm = form.baseline ? parseNumber(form.baselineKm) : null;
		if (form.baseline && (baselineKm == null || !Number.isInteger(baselineKm))) {
			setError({ field: "baselineKm", message: "Enter the mileage it was done at" });
			return;
		}
		const values = {
			name: form.name,
			intervalKm,
			intervalMonths,
			note: form.note,
			baselineDate: form.baseline ? form.baselineDate : null,
			baselineKm: form.baseline ? baselineKm : null,
		};
		startSave(async () => {
			const result = await (item
				? updateItem(item.id, values)
				: createItem(vehicleId, values)
			).catch(() => ({ error: "Couldn't save. Check your connection." }));
			if ("error" in result) setError({ message: result.error });
			else onOpenChange(false);
		});
	}

	const invalid = (field: keyof Form) => error?.field === field || undefined;

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className={cn("sm:max-w-md max-sm:flex max-sm:flex-col", instantClass(instant))}
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					if (!item) document.getElementById(`${id}-name`)?.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>{item ? "Edit Item" : "New Item"}</DialogTitle>
					<DialogDescription className="sr-only">
						A maintenance task and how often it's due.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-name`}>Name</Label>
						<Input
							id={`${id}-name`}
							maxLength={80}
							autoComplete="off"
							placeholder="Timing belt"
							value={form.name}
							aria-invalid={invalid("name")}
							onChange={(e) => set("name", e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label htmlFor={`${id}-km`}>Every, km</Label>
								<Input
									id={`${id}-km`}
									inputMode="numeric"
									autoComplete="off"
									className="font-figures"
									value={form.intervalKm}
									aria-invalid={invalid("intervalKm")}
									onChange={(e) => set("intervalKm", e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${id}-months`}>Every, months</Label>
								<Input
									id={`${id}-months`}
									inputMode="numeric"
									autoComplete="off"
									className="font-figures"
									value={form.intervalMonths}
									aria-invalid={invalid("intervalKm")}
									onChange={(e) => set("intervalMonths", e.target.value)}
								/>
							</div>
						</div>
						<p className="text-xs text-muted-foreground">Due at whichever comes first.</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${id}-note`}>Note</Label>
						<Input
							id={`${id}-note`}
							autoComplete="off"
							placeholder="Optional"
							value={form.note}
							onChange={(e) => set("note", e.target.value)}
						/>
					</div>

					<AutoHeight>
						{form.baseline ? (
							<div className="animate-swap space-y-2">
								<div className="flex items-baseline justify-between gap-3">
									<span className="text-sm font-medium">Last done before Aisha</span>
									<button
										type="button"
										className="rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
										onClick={() => set("baseline", false)}
									>
										Don't know
									</button>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<Input
										type="date"
										aria-label="Date it was last done"
										max={localToday()}
										value={form.baselineDate}
										onChange={(e) => set("baselineDate", e.target.value)}
									/>
									<Input
										inputMode="numeric"
										autoComplete="off"
										aria-label="Mileage it was last done at, km"
										placeholder="km"
										className="font-figures"
										value={form.baselineKm}
										aria-invalid={invalid("baselineKm")}
										onChange={(e) => set("baselineKm", e.target.value)}
									/>
								</div>
								<p className="text-xs text-muted-foreground">
									Counts until a logged service says otherwise.
								</p>
							</div>
						) : (
							<QuietAdd onClick={() => set("baseline", true)}>When it was last done</QuietAdd>
						)}
					</AutoHeight>

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
							{isSaving ? "Saving…" : item ? "Save" : "Add Item"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
