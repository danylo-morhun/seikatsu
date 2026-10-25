"use client";

import { Spinner } from "@/components/Spinner";
import { addReading } from "@/features/aisha/actions/readings";
import { formatKm, parseNumber } from "@/features/aisha/lib/format";
import { localToday } from "@/features/aisha/lib/today";
import { Button, Input, cn } from "@seikatsu/ui";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Aisha on the seikatsu home: the next thing the car needs, and the odometer, updated
 * without opening the app.
 */
export function HomeMileage({
	vehicleId,
	currentKm,
	next,
	late,
}: {
	vehicleId: string;
	currentKm: number;
	next: string | null;
	late: boolean;
}) {
	const id = useId();
	const [km, setKm] = useState("");
	const [isSaving, startSave] = useTransition();

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const value = parseNumber(km);
		if (value == null || !Number.isInteger(value)) {
			toast.error("Enter the mileage in whole km");
			return;
		}
		startSave(async () => {
			const result = await addReading(vehicleId, { date: localToday(), km: value }).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
			else setKm("");
		});
	}

	return (
		<div className="relative z-10 mt-4 space-y-3">
			{next && (
				<p className="text-sm">
					<span className="text-muted-foreground">Next · </span>
					<span className={cn(late && "text-negative")}>{next}</span>
				</p>
			)}
			<form onSubmit={handleSubmit} className="flex items-center gap-2">
				<label htmlFor={`${id}-km`} className="sr-only">
					Odometer now, km
				</label>
				<Input
					id={`${id}-km`}
					inputMode="numeric"
					autoComplete="off"
					placeholder={formatKm(currentKm)}
					className="h-9 max-w-40 font-figures"
					value={km}
					onChange={(e) => setKm(e.target.value)}
				/>
				<Button
					type="submit"
					size="sm"
					variant="outline"
					className="gap-1.5"
					disabled={isSaving || !km.trim()}
				>
					{isSaving && <Spinner />}
					{isSaving ? "Saving…" : "Update km"}
				</Button>
			</form>
		</div>
	);
}
