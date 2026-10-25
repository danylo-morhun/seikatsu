"use client";

import { Spinner } from "@/components/Spinner";
import { createVehicle, updateVehicle } from "@/features/aisha/actions/vehicles";
import type { AishaVehicle } from "@/features/aisha/actions/vehicles";
import { FieldError } from "@/features/aisha/components/DialogParts";
import {
	FUEL_LABELS,
	FUEL_TYPES,
	type FuelType,
	TRANSMISSIONS,
	TRANSMISSION_LABELS,
	type Transmission,
} from "@/features/aisha/lib/constants";
import { parseNumber } from "@/features/aisha/lib/format";
import { localToday } from "@/features/aisha/lib/today";
import {
	Button,
	Checkbox,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

type Form = {
	make: string;
	model: string;
	year: string;
	engine: string;
	fuelType: FuelType;
	transmission: Transmission;
	plate: string;
	vin: string;
	km: string;
	servicedNow: boolean;
};

function formOf(vehicle: AishaVehicle | null): Form {
	return {
		make: vehicle?.make ?? "",
		model: vehicle?.model ?? "",
		year: vehicle?.year.toString() ?? "",
		engine: vehicle?.engine ?? "",
		fuelType: vehicle?.fuelType ?? "petrol",
		transmission: vehicle?.transmission ?? "unknown",
		plate: vehicle?.plate ?? "",
		vin: vehicle?.vin ?? "",
		km: "",
		servicedNow: true,
	};
}

/** The car's details: the first-run form (with its mileage), or the settings form. */
export function VehicleForm({
	workspaceId,
	vehicle = null,
}: {
	workspaceId: string;
	/** null = add the car. */
	vehicle?: AishaVehicle | null;
}) {
	const id = useId();
	const [form, setForm] = useState(() => formOf(vehicle));
	const [error, setError] = useState<{ field?: keyof Form; message: string } | null>(null);
	const [isSaving, startSave] = useTransition();
	const set = <K extends keyof Form>(key: K, value: Form[K]) => {
		setForm((f) => ({ ...f, [key]: value }));
		setError(null);
	};
	const invalid = (field: keyof Form) => error?.field === field || undefined;
	const fail = (field: keyof Form, message: string) => {
		setError({ field, message });
		document.getElementById(`${id}-${field}`)?.focus();
	};

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.make.trim()) return fail("make", "Enter the make");
		if (!form.model.trim()) return fail("model", "Enter the model");
		const year = parseNumber(form.year);
		if (year == null || !Number.isInteger(year) || year < 1950 || year > 2100) {
			return fail("year", "Enter the year it was made");
		}
		const km = parseNumber(form.km);
		if (!vehicle && (km == null || !Number.isInteger(km))) {
			return fail("km", "Enter the mileage in whole km");
		}
		const details = {
			make: form.make,
			model: form.model,
			year,
			engine: form.engine,
			fuelType: form.fuelType,
			transmission: form.transmission,
			plate: form.plate,
			vin: form.vin,
		};
		startSave(async () => {
			const result = await (vehicle
				? updateVehicle(vehicle.id, details)
				: createVehicle(workspaceId, {
						...details,
						currentKm: km ?? 0,
						today: localToday(),
						servicedNow: form.servicedNow,
					})
			).catch(() => ({ error: "Couldn't save. Check your connection." }));
			if ("error" in result) setError({ message: result.error });
			else if (vehicle) toast.success("Car saved");
		});
	}

	const field = (
		key: keyof Form,
		label: string,
		props: React.ComponentProps<typeof Input> = {},
	) => (
		<div className="space-y-2">
			<Label htmlFor={`${id}-${key}`}>{label}</Label>
			<Input
				id={`${id}-${key}`}
				autoComplete="off"
				value={form[key] as string}
				aria-invalid={invalid(key)}
				onChange={(e) => set(key, e.target.value as never)}
				{...props}
			/>
		</div>
	);

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-3">
				{field("make", "Make", { placeholder: "Hyundai", maxLength: 50 })}
				{field("model", "Model", { placeholder: "i30", maxLength: 50 })}
				{field("year", "Year", {
					placeholder: "2017",
					inputMode: "numeric",
					className: "font-figures",
				})}
				{field("engine", "Engine", { placeholder: "1.6 CRDi" })}
				<div className="space-y-2">
					<Label htmlFor={`${id}-fuel`}>Fuel</Label>
					<Select value={form.fuelType} onValueChange={(v) => set("fuelType", v as FuelType)}>
						<SelectTrigger id={`${id}-fuel`}>
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
				<div className="space-y-2">
					<Label htmlFor={`${id}-gearbox`}>Gearbox</Label>
					<Select
						value={form.transmission}
						onValueChange={(v) => set("transmission", v as Transmission)}
					>
						<SelectTrigger id={`${id}-gearbox`}>
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
				{field("plate", "Plate", {
					placeholder: "Optional",
					className: "uppercase placeholder:normal-case",
				})}
				{vehicle
					? field("vin", "VIN", {
							placeholder: "Optional",
							className: "uppercase placeholder:normal-case font-figures",
						})
					: field("km", "Mileage now, km", {
							inputMode: "numeric",
							placeholder: "167 000",
							className: "font-figures",
						})}
			</div>

			{!vehicle && (
				<div className="flex items-start gap-3">
					<Checkbox
						id={`${id}-serviced`}
						checked={form.servicedNow}
						onCheckedChange={(v) => set("servicedNow", v === true)}
						className="mt-0.5"
					/>
					<Label htmlFor={`${id}-serviced`} className="block font-normal leading-snug">
						<span className="block text-sm">Serviced when I got it</span>
						<span className="mt-0.5 block text-xs text-muted-foreground">
							Every item counts from today's mileage. Untick if you don't know.
						</span>
					</Label>
				</div>
			)}

			{error && <FieldError>{error.message}</FieldError>}
			<div>
				<Button type="submit" className="gap-1.5" disabled={isSaving}>
					{isSaving && <Spinner />}
					{isSaving ? "Saving…" : vehicle ? "Save" : "Add the car"}
				</Button>
			</div>
		</form>
	);
}
