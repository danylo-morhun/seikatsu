import { getCar, getCurrentVehicle } from "@/features/aisha/actions/data";
import { HomeMileage } from "@/features/aisha/components/HomeMileage";
import { formatDays, formatKm } from "@/features/aisha/lib/format";
import { getUserToday } from "@/lib/timezone";

/** The home card's glance: what the car needs next, and the odometer a tap from updating. */
export async function AishaHomeWidget() {
	const vehicle = await getCurrentVehicle();
	if (!vehicle) return null;
	const car = await getCar(vehicle, await getUserToday());
	const next = car.queue.due[0] ?? car.queue.later[0];

	let line: string | null = null;
	if (next?.entry.kind === "document") {
		const { doc } = next.entry;
		line = `${doc.name} · ${doc.daysLeft < 0 ? `expired ${formatDays(doc.daysLeft)}` : `ends ${formatDays(doc.daysLeft)}`}`;
	} else if (next?.entry.kind === "item") {
		const { item } = next.entry;
		const { kmLeft, daysLeft } = item.due;
		const when =
			kmLeft != null && kmLeft <= 0
				? `${formatKm(-kmLeft)} over`
				: daysLeft != null && daysLeft <= 0
					? `due ${formatDays(daysLeft)}`
					: kmLeft != null
						? `in ${formatKm(kmLeft)}`
						: daysLeft != null
							? formatDays(daysLeft)
							: null;
		line = when ? `${item.name} · ${when}` : item.name;
	}

	return (
		<HomeMileage
			vehicleId={vehicle.id}
			currentKm={car.currentKm}
			next={line}
			late={next?.status === "overdue"}
		/>
	);
}
