import { auth } from "@/auth";
import { getDashboard } from "@/features/aisha/actions/data";
import { getVehicles } from "@/features/aisha/actions/vehicles";
import { AishaDashboard } from "@/features/aisha/components/AishaDashboard";
import { VehicleSetup } from "@/features/aisha/components/VehicleSetup";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { redirect } from "next/navigation";

export default async function AishaPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	// One car for now; the schema already allows more.
	const [vehicle] = await getVehicles(workspace.id);
	if (!vehicle) return <VehicleSetup workspaceId={workspace.id} />;

	const today = new Date().toISOString().slice(0, 10);
	const data = await getDashboard(vehicle.id, today);
	if (!data) redirect("/");

	return <AishaDashboard data={data} today={today} />;
}
