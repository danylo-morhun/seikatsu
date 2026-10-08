import { auth } from "@/auth";
import { getDashboard } from "@/features/aisha/actions/data";
import { getVehicles } from "@/features/aisha/actions/vehicles";
import { AishaDashboard } from "@/features/aisha/components/AishaDashboard";
import { VehicleSetup } from "@/features/aisha/components/VehicleSetup";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";

// Every save re-renders the page and resends the dashboard; the full history is one click away.
const RECENT_SERVICES = 30;

export default async function AishaPage({
	searchParams,
}: {
	searchParams: Promise<{ history?: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	// One car for now; the schema already allows more.
	const [vehicle] = await getVehicles(workspace.id);
	if (!vehicle) return <VehicleSetup workspaceId={workspace.id} />;

	const today = await getUserToday();
	const data = await getDashboard(vehicle, today);

	const showAll = (await searchParams).history === "all";
	const services = showAll ? data.services : data.services.slice(0, RECENT_SERVICES);

	return (
		<AishaDashboard
			data={{ ...data, services }}
			serviceCount={data.services.length}
			today={today}
		/>
	);
}
