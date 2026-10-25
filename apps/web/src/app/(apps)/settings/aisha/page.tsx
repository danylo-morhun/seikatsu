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
		<div className="max-w-3xl px-4 pt-6 pb-28 sm:px-8 md:pt-8 md:pb-8">
			<h1 className="mb-8 text-xl font-semibold">愛 Aisha</h1>
			{vehicle ? (
				<Settings vehicle={vehicle} />
			) : (
				<p className="text-sm text-muted-foreground">
					No car yet.{" "}
					<Link
						href="/aisha"
						prefetch
						className="text-foreground underline-offset-2 hover:underline"
					>
						Add it in Aisha
					</Link>
					, then its plan and paperwork show here.
				</p>
			)}
		</div>
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
