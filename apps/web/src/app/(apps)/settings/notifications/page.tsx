import { getNotificationSettings } from "@/features/pwa/actions/push";
import { DeviceList } from "@/features/pwa/components/DeviceList";
import { NotificationPrefsForm } from "@/features/pwa/components/NotificationPrefsForm";
import { ThisDevice } from "@/features/pwa/components/ThisDevice";
import { getCurrentWorkspace } from "@/lib/session";
import { Separator } from "@seikatsu/ui";
import { redirect } from "next/navigation";

export default async function NotificationSettingsPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const { prefs, devices, configured } = await getNotificationSettings();

	return (
		<div className="max-w-3xl px-4 py-6 sm:px-8 md:pt-8">
			<h1 className="mb-8 text-xl font-semibold">Notifications</h1>

			<section className="mb-10">
				<h2 className="mb-1 text-base font-semibold">This device</h2>
				<p className="mb-4 text-sm text-muted-foreground">
					Push arrives even when seikatsu is closed.
				</p>
				<ThisDevice configured={configured} />
			</section>

			<Separator className="my-8" />

			<section className="mb-10">
				<h2 className="mb-1 text-base font-semibold">What to send</h2>
				<p className="mb-4 text-sm text-muted-foreground">
					Times are in your time zone. Each goes out once, to every device below.
				</p>
				<NotificationPrefsForm prefs={prefs} />
			</section>

			<Separator className="my-8" />

			<section>
				<h2 className="mb-1 text-base font-semibold">Devices</h2>
				<p className="mb-4 text-sm text-muted-foreground">Where notifications go.</p>
				<DeviceList devices={devices} />
			</section>
		</div>
	);
}
