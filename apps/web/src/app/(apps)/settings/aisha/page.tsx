import { NOTE_LINK, SettingsPage } from "@/components/SettingsSection";
import { getCar, getCurrentVehicle } from "@/features/aisha/actions/data";
import { SettingsAisha } from "@/features/aisha/components/SettingsAisha";
import { getAccounts } from "@/features/kuroji/actions/accounts";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AishaSettingsPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const vehicle = await getCurrentVehicle();

	return (
		<SettingsPage title="愛 Aisha" appNav>
			{vehicle ? (
				<Settings vehicle={vehicle} />
			) : (
				<p className="border-y border-rule py-4 text-sm text-muted-foreground">
					No car yet.{" "}
					<Link href="/aisha" prefetch className={NOTE_LINK}>
						Add it in Aisha
					</Link>
					, then its plan and paperwork show here.
				</p>
			)}
		</SettingsPage>
	);
}

async function Settings({
	vehicle,
}: { vehicle: NonNullable<Awaited<ReturnType<typeof getCurrentVehicle>>> }) {
	const [car, accounts] = await Promise.all([
		getCar(vehicle, await getUserToday()),
		getAccounts(vehicle.workspaceId),
	]);
	// The plan in the order it was set up, not by urgency.
	const items = [...car.items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	return (
		<SettingsAisha vehicle={vehicle} items={items} documents={car.documents} accounts={accounts} />
	);
}
