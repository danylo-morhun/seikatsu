"use client";

import { Spinner } from "@/components/Spinner";
import { addReading } from "@/features/aisha/actions/readings";
import { localToday } from "@/features/aisha/lib/today";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Label,
} from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function UpdateMileageModal({
	vehicleId,
	currentKm,
	trigger,
}: {
	vehicleId: string;
	currentKm: number;
	trigger: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const [date, setDate] = useState(localToday);
	const [km, setKm] = useState("");

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		startTransition(async () => {
			const res = await addReading(vehicleId, {
				date,
				km: Number.parseInt(km.replace(/\s/g, ""), 10),
			});
			if ("error" in res) {
				toast.error(res.error);
				return;
			}
			toast.success("Mileage updated.");
			setOpen(false);
			setKm("");
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (v) setDate(localToday());
			}}
		>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-xs">
				<DialogHeader>
					<DialogTitle>Update mileage</DialogTitle>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="space-y-1.5">
						<Label htmlFor="m-km">Odometer (km)</Label>
						<Input
							id="m-km"
							inputMode="numeric"
							autoFocus
							value={km}
							onChange={(e) => setKm(e.target.value)}
							placeholder={String(currentKm)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="m-date">Date</Label>
						<Input id="m-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
					</div>
					<div className="flex justify-end gap-2 pt-1">
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={pending} className="gap-1.5">
							{pending && <Spinner />}
							{pending ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
