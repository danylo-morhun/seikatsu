import { SettingsPage, SettingsSection } from "@/components/SettingsSection";
import { getNotificationSettings } from "@/features/pwa/actions/push";
import { DeviceList } from "@/features/pwa/components/DeviceList";
import { NotificationPrefsForm } from "@/features/pwa/components/NotificationPrefsForm";
import { ThisDevice } from "@/features/pwa/components/ThisDevice";
import { getCurrentWorkspace } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function NotificationSettingsPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const { prefs, devices, configured } = await getNotificationSettings();

	return (
		<SettingsPage title="Notifications">
			<SettingsSection title="This device" description="Push arrives even when seikatsu is closed.">
				<ThisDevice configured={configured} />
			</SettingsSection>

			<SettingsSection
				title="What to send"
				description="In your time zone. Each one goes out once, to every device below."
			>
				<NotificationPrefsForm prefs={prefs} />
			</SettingsSection>

			<SettingsSection
				title="Devices"
				description="Where notifications go."
				meta={devices.length > 0 ? devices.length : undefined}
			>
				<DeviceList devices={devices} />
			</SettingsSection>
		</SettingsPage>
	);
}
