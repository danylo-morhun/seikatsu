import { getCar, getCurrentVehicle } from "@/features/aisha/actions/data";
import { AishaWelcome } from "@/features/aisha/components/AishaWelcome";
import { NextView } from "@/features/aisha/components/NextView";
import { CURRENCY } from "@/features/aisha/lib/constants";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";

export default async function AishaPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");

	const vehicle = await getCurrentVehicle();
	if (!vehicle) {
		return (
			<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
				<AishaWelcome workspaceId={workspace.id} />
			</div>
		);
	}

	const today = await getUserToday();
	const car = await getCar(vehicle, today);
	const thisYear = car.services.filter((s) => s.date.startsWith(today.slice(0, 4)));

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<NextView
				car={{
					vehicle: car.vehicle,
					queue: car.queue,
					firstReading: car.firstReading,
					currentKm: car.currentKm,
					kmPerDay: car.kmPerDay,
					documentCount: car.documents.length,
				}}
				today={today}
				spent={{
					amount: thisYear.reduce((n, s) => n + (s.cost != null ? Number(s.cost) : 0), 0),
					services: thisYear.length,
					currency: thisYear[0]?.currency ?? CURRENCY,
				}}
			/>
		</div>
	);
}
