"use client";

import { Spinner } from "@/components/Spinner";
import { logService } from "@/features/aisha/actions/services";
import { CURRENCY } from "@/features/aisha/lib/constants";
import { localToday } from "@/features/aisha/lib/today";
import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Label,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function LogServiceModal({
	vehicleId,
	currentKm,
	items,
	preselected = [],
	trigger,
}: {
	vehicleId: string;
	currentKm: number;
	items: { id: string; name: string }[];
	preselected?: string[];
	trigger: React.ReactNode;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const [date, setDate] = useState(localToday);
	const [km, setKm] = useState(String(currentKm));
	const [selected, setSelected] = useState<string[]>(preselected);
	const [cost, setCost] = useState("");
	const [shop, setShop] = useState("");
	const [note, setNote] = useState("");

	function reset() {
		setDate(localToday());
		setKm(String(currentKm));
		setSelected(preselected);
		setCost("");
		setShop("");
		setNote("");
	}

	function toggle(id: string, on: boolean) {
		setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
	}

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const parsedCost = cost.trim() ? Number.parseFloat(cost.replace(",", ".")) : null;
		startTransition(async () => {
			const res = await logService(vehicleId, {
				date,
				km: Number.parseInt(km.replace(/\s/g, ""), 10),
				itemIds: selected,
				cost: parsedCost,
				shop,
				note,
			});
			if ("error" in res) {
				toast.error(res.error);
				return;
			}
			toast.success("Service logged.");
			setOpen(false);
			router.refresh();
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (v) reset();
			}}
		>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Log service</DialogTitle>
					<DialogDescription>What was done? Pick everything from this visit.</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="s-date">Date</Label>
							<Input
								id="s-date"
								type="date"
								value={date}
								onChange={(e) => setDate(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="s-km">Mileage (km)</Label>
							<Input
								id="s-km"
								inputMode="numeric"
								value={km}
								onChange={(e) => setKm(e.target.value)}
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label>Done</Label>
						<div className="grid gap-1.5 rounded-lg border border-border/60 p-2">
							{items.map((item) => (
								<label
									key={item.id}
									htmlFor={`s-item-${item.id}`}
									className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/50"
								>
									<Checkbox
										id={`s-item-${item.id}`}
										checked={selected.includes(item.id)}
										onCheckedChange={(v) => toggle(item.id, v === true)}
									/>
									{item.name}
								</label>
							))}
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="s-cost">Cost ({CURRENCY})</Label>
							<Input
								id="s-cost"
								inputMode="decimal"
								value={cost}
								onChange={(e) => setCost(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="s-shop">Garage</Label>
							<Input id="s-shop" value={shop} onChange={(e) => setShop(e.target.value)} />
						</div>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="s-note">Note</Label>
						<Input
							id="s-note"
							value={note}
							onChange={(e) => setNote(e.target.value)}
							placeholder="e.g. Oil 5W-30, mechanic said pads at 40%"
						/>
					</div>
					<div className="flex justify-end gap-2 pt-1">
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={pending || selected.length === 0} className="gap-1.5">
							{pending && <Spinner />}
							{pending ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
