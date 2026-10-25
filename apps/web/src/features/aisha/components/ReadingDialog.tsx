"use client";

import { Spinner } from "@/components/Spinner";
import type { AishaReading } from "@/features/aisha/actions/data";
import { addReading, updateReading } from "@/features/aisha/actions/readings";
import { FOOTER, FieldError, instantClass } from "@/features/aisha/components/DialogParts";
import { formatKm, parseNumber } from "@/features/aisha/lib/format";
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

/** The odometer today (a new reading, opened on the km), or an older reading's date and km. */
export function ReadingDialog({
	open,
	onOpenChange,
	instant,
	vehicleId,
	currentKm,
	reading = null,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	instant?: boolean;
	vehicleId: string;
	currentKm: number;
	/** null = a new reading. */
	reading?: AishaReading | null;
}) {
	const id = useId();
	const [date, setDate] = useState(localToday);
	const [km, setKm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();

	useEffect(() => {
		if (!open) return;
		setDate(reading?.date ?? localToday());
		setKm(reading ? String(reading.km) : "");
		setError(null);
		// Each opening starts from the saved reading; a re-render while open keeps the edits.
	}, [open]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const value = parseNumber(km);
		if (value == null || !Number.isInteger(value)) {
			setError("Enter the mileage in whole km");
			document.getElementById(`${id}-km`)?.focus();
			return;
		}
		startSave(async () => {
			const values = { date, km: value };
			const result = await (reading
				? updateReading(reading.id, values)
				: addReading(vehicleId, values)
			).catch(() => ({ error: "Couldn't save. Check your connection." }));
			if ("error" in result) setError(result.error);
			else onOpenChange(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className={cn("sm:max-w-sm max-sm:flex max-sm:flex-col", instantClass(instant))}
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					document.getElementById(`${id}-km`)?.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>{reading ? "Edit Reading" : "Update Mileage"}</DialogTitle>
					<DialogDescription className={reading ? "sr-only" : undefined}>
						{reading
							? "When the odometer read what."
							: `Last known ${formatKm(currentKm)}. Due dates follow how much you drive.`}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-km`}>Odometer, km</Label>
						<Input
							id={`${id}-km`}
							inputMode="numeric"
							autoComplete="off"
							placeholder={String(currentKm)}
							className="h-11 font-figures text-lg font-semibold"
							value={km}
							aria-invalid={error ? true : undefined}
							onChange={(e) => {
								setKm(e.target.value);
								setError(null);
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${id}-date`}>Date</Label>
						<Input
							id={`${id}-date`}
							type="date"
							required
							max={localToday()}
							value={date}
							onChange={(e) => {
								setDate(e.target.value);
								setError(null);
							}}
						/>
					</div>
					{error && <FieldError>{error}</FieldError>}
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
							{isSaving ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
