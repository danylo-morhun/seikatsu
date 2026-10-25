import { getCar, getChromeData, getCurrentVehicle } from "@/features/aisha/actions/data";
import { type HistoryReading, HistoryView } from "@/features/aisha/components/HistoryView";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";

// Every save re-renders the page and resends the list; the full history is one click away.
const RECENT_SERVICES = 50;

export default async function AishaHistoryPage({
	searchParams,
}: {
	searchParams: Promise<{ all?: string }>;
}) {
	const vehicle = await getCurrentVehicle();
	if (!vehicle) redirect("/aisha");

	const [{ all }, today] = await Promise.all([searchParams, getUserToday()]);
	const [car, chrome] = await Promise.all([getCar(vehicle, today), getChromeData()]);
	if (!chrome) redirect("/aisha");

	// Newest first, each with how far the car went since the reading before it.
	const readings: HistoryReading[] = car.readings
		.map((r, i) => ({ ...r, delta: i > 0 ? r.km - car.readings[i - 1].km : null }))
		.reverse();

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<HistoryView
				car={chrome}
				services={all ? car.services : car.services.slice(0, RECENT_SERVICES)}
				serviceCount={car.services.length}
				readings={readings}
			/>
		</div>
	);
}
