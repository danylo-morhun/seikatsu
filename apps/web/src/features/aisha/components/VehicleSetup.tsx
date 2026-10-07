"use client";

import { Spinner } from "@/components/Spinner";
import { createVehicle } from "@/features/aisha/actions/vehicles";
import {
	FUEL_LABELS,
	FUEL_TYPES,
	type FuelType,
	TRANSMISSIONS,
	TRANSMISSION_LABELS,
	type Transmission,
} from "@/features/aisha/lib/constants";
import { localToday } from "@/features/aisha/lib/today";
import {
	Button,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function VehicleSetup({ workspaceId }: { workspaceId: string }) {
	const [pending, startTransition] = useTransition();
	const [make, setMake] = useState("");
	const [model, setModel] = useState("");
	const [year, setYear] = useState("");
	const [engine, setEngine] = useState("");
	const [fuelType, setFuelType] = useState<FuelType>("petrol");
	const [transmission, setTransmission] = useState<Transmission>("unknown");
	const [plate, setPlate] = useState("");
	const [currentKm, setCurrentKm] = useState("");

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		startTransition(async () => {
			const res = await createVehicle(workspaceId, {
				make,
				model,
				year: Number.parseInt(year, 10),
				engine,
				fuelType,
				transmission,
				plate,
				currentKm: Number.parseInt(currentKm.replace(/\s/g, ""), 10),
				today: localToday(),
			});
			if ("error" in res) {
				toast.error(res.error);
				return;
			}
			toast.success("Car added. Default maintenance plan created.");
		});
	}

	return (
		<div className="mx-auto max-w-md px-4 py-10">
			<h1 className="text-lg font-semibold">Add your car</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Aisha builds a maintenance plan from this. You can change any interval later.
			</p>
			<form onSubmit={onSubmit} className="mt-6 space-y-3">
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label htmlFor="v-make">Make</Label>
						<Input
							id="v-make"
							value={make}
							onChange={(e) => setMake(e.target.value)}
							placeholder="Hyundai"
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="v-model">Model</Label>
						<Input
							id="v-model"
							value={model}
							onChange={(e) => setModel(e.target.value)}
							placeholder="i30"
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="v-year">Year</Label>
						<Input
							id="v-year"
							inputMode="numeric"
							value={year}
							onChange={(e) => setYear(e.target.value)}
							placeholder="2017"
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="v-engine">Engine</Label>
						<Input
							id="v-engine"
							value={engine}
							onChange={(e) => setEngine(e.target.value)}
							placeholder="1.6 CRDi"
						/>
					</div>
				</div>
				<div className="space-y-1.5">
					<Label>Fuel</Label>
					<Select value={fuelType} onValueChange={(v) => setFuelType(v as FuelType)}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{FUEL_TYPES.map((f) => (
								<SelectItem key={f} value={f}>
									{FUEL_LABELS[f]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<Label>Gearbox</Label>
					<Select value={transmission} onValueChange={(v) => setTransmission(v as Transmission)}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{TRANSMISSIONS.map((t) => (
								<SelectItem key={t} value={t}>
									{TRANSMISSION_LABELS[t]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label htmlFor="v-plate">Plate</Label>
						<Input id="v-plate" value={plate} onChange={(e) => setPlate(e.target.value)} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="v-km">Current mileage (km)</Label>
						<Input
							id="v-km"
							inputMode="numeric"
							value={currentKm}
							onChange={(e) => setCurrentKm(e.target.value)}
						/>
					</div>
				</div>
				<Button type="submit" disabled={pending} className="w-full gap-1.5">
					{pending && <Spinner />}
					{pending ? "Saving…" : "Add car"}
				</Button>
			</form>
		</div>
	);
}
